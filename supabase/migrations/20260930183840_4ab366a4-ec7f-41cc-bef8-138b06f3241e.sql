CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Profiles (clients identified by phone)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'client',
  name text NOT NULL,
  nickname text,
  phone text NOT NULL UNIQUE,
  preferences text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_min int NOT NULL DEFAULT 30,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active services" ON public.services FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage services" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.business_hours (
  weekday int PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '19:00',
  lunch_start time,
  lunch_end time
);
GRANT SELECT ON public.business_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT ALL ON public.business_hours TO service_role;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read hours" ON public.business_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage hours" ON public.business_hours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  start_time time,
  end_time time,
  reason text NOT NULL DEFAULT 'Folga',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read blocks" ON public.blocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin manage blocks" ON public.blocks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','completed','cancelled','no_show')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('confirmed','completed'))
);
CREATE INDEX appointments_starts_idx ON public.appointments(starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all appointments" ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all ratings" ON public.ratings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified','booked','removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all waitlist" ON public.waitlist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.loyalty (
  client_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  points int NOT NULL DEFAULT 0,
  total_cuts int NOT NULL DEFAULT 0,
  free_used int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty TO authenticated;
GRANT ALL ON public.loyalty TO service_role;
ALTER TABLE public.loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all loyalty" ON public.loyalty FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Loyalty trigger: on completion
CREATE OR REPLACE FUNCTION public.handle_appointment_loyalty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.loyalty (client_id) VALUES (NEW.client_id) ON CONFLICT (client_id) DO NOTHING;
    IF NEW.is_free THEN
      UPDATE public.loyalty SET points = GREATEST(points - 10, 0), free_used = free_used + 1, total_cuts = total_cuts + 1, updated_at = now() WHERE client_id = NEW.client_id;
    ELSE
      UPDATE public.loyalty SET points = points + 1, total_cuts = total_cuts + 1, updated_at = now() WHERE client_id = NEW.client_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    IF OLD.is_free THEN
      UPDATE public.loyalty SET points = points + 10, free_used = GREATEST(free_used - 1,0), total_cuts = GREATEST(total_cuts - 1,0) WHERE client_id = NEW.client_id;
    ELSE
      UPDATE public.loyalty SET points = GREATEST(points - 1,0), total_cuts = GREATEST(total_cuts - 1,0) WHERE client_id = NEW.client_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointments_loyalty AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_loyalty();

-- Seed
INSERT INTO public.services (name, description, price, duration_min, sort) VALUES
 ('Corte Clássico', 'Tesoura e máquina, acabamento na navalha.', 45, 40, 1),
 ('Degradê (Fade)', 'Degradê navalhado do zero ao topo, com desenho opcional.', 50, 45, 2),
 ('Barba Completa', 'Toalha quente, modelagem e navalha.', 35, 30, 3),
 ('Combo Corte + Barba', 'O pacote completo da Barbearia 49.', 75, 70, 4),
 ('Pezinho / Acabamento', 'Contorno e acabamento rápido.', 20, 15, 5),
 ('Sobrancelha', 'Limpeza e alinhamento na navalha.', 15, 15, 6);

INSERT INTO public.business_hours (weekday, is_open, open_time, close_time, lunch_start, lunch_end) VALUES
 (0, false, '09:00', '13:00', NULL, NULL),
 (1, false, '09:00', '19:00', '12:00', '13:00'),
 (2, true, '09:00', '19:00', '12:00', '13:00'),
 (3, true, '09:00', '19:00', '12:00', '13:00'),
 (4, true, '09:00', '19:00', '12:00', '13:00'),
 (5, true, '09:00', '20:00', '12:00', '13:00'),
 (6, true, '08:00', '17:00', '12:00', '13:00');