-- Barbearia 49 — Seed real services
-- Removes old demo data and inserts the complete official service menu.

DELETE FROM public.services;

INSERT INTO public.services (id, name, description, price, duration_min, active, sort) VALUES

-- ── Cortes e Combos ──────────────────────────────────────────────────────
('c1000000-0000-4000-8000-000000000001', 'Corte seg. a qua.',        'Corte clássico com tesoura e máquina, disponível de segunda a quarta.',                                           35.00,  30, true,  1),
('c1000000-0000-4000-8000-000000000002', 'Corte qui. a sáb.',        'Corte clássico com tesoura e máquina, disponível de quinta a sábado.',                                            40.00,  40, true,  2),
('c1000000-0000-4000-8000-000000000003', 'Corte + sobrancelha',      'Corte completo com alinhamento e design de sobrancelha na navalha.',                                              55.00,  40, true,  3),
('c1000000-0000-4000-8000-000000000004', 'Corte + cavanhaque',       'Corte completo com alinhamento e aparação do cavanhaque.',                                                        55.00,  40, true,  4),
('c1000000-0000-4000-8000-000000000005', 'Corte + barba',            'Corte completo + barba feita com toalha quente e acabamento navalhado.',                                          70.00,  60, true,  5),
('c1000000-0000-4000-8000-000000000006', 'Combo corte + barboterapia','Corte + barboterapia com toalha quente, massagem facial e hidratação profissional.',                             85.00,  60, true,  6),
('c1000000-0000-4000-8000-000000000007', 'Corte + alisante',         'Corte completo com aplicação de alisante para um visual liso e sofisticado.',                                    60.00,  60, true,  7),
('c1000000-0000-4000-8000-000000000008', 'Corte + pigmentação',      'Corte completo com pigmentação para cobrir falhas e uniformizar o visual.',                                       60.00,  60, true,  8),
('c1000000-0000-4000-8000-000000000009', 'Corte + penteado',         'Corte completo com finalização e penteado personalizado.',                                                        60.00,  50, true,  9),
('c1000000-0000-4000-8000-000000000010', 'Corte + luzes',            'Corte completo com aplicação de luzes para realçar o visual.',                                                   100.00, 180, true, 10),
('c1000000-0000-4000-8000-000000000011', 'Corte 1 máquina',          'Corte rápido na máquina, ideal para quem curte o visual mais curto e prático.',                                   30.00,  30, true, 11),

-- ── Serviços Individuais ─────────────────────────────────────────────────
('s2000000-0000-4000-8000-000000000001', 'Sobrancelha',              'Alinhamento e design de sobrancelha na navalha.',                                                                 15.00,   5, true, 12),
('s2000000-0000-4000-8000-000000000002', 'Cavanhaque',               'Aparação e alinhamento do cavanhaque com acabamento navalhado.',                                                   15.00,  10, true, 13),
('s2000000-0000-4000-8000-000000000003', 'Barba',                    'Barba completa com toalha quente e acabamento navalhado.',                                                         30.00,  20, true, 14),
('s2000000-0000-4000-8000-000000000004', 'Barboterapia',             'Tratamento completo de barba: toalha quente, massagem facial, esfoliação e óleo hidratante.',                     40.00,  30, true, 15),
('s2000000-0000-4000-8000-000000000005', 'Pigmentação',              'Aplicação de pigmentação para cobrir falhas e uniformizar a barba ou cabelo.',                                    30.00,  30, true, 16),
('s2000000-0000-4000-8000-000000000006', 'Penteado',                 'Finalização e penteado personalizado com produtos premium.',                                                       20.00,  20, true, 17),
('s2000000-0000-4000-8000-000000000007', 'Alisante',                 'Aplicação de alisante para um visual liso e controlado.',                                                         30.00,  20, true, 18),
('s2000000-0000-4000-8000-000000000008', 'Luzes',                    'Aplicação de luzes para realçar e iluminar o visual.',                                                            60.00, 180, true, 19),
('s2000000-0000-4000-8000-000000000009', 'Progressiva',              'Progressiva capilar para alisar e reduzir o volume dos fios.',                                                     0.00,  60, true, 20),
('s2000000-0000-4000-8000-000000000010', 'Botox capilar',            'Tratamento de botox capilar para hidratar, brilhar e reduzir o frizz.',                                          50.00,  60, true, 21),
('s2000000-0000-4000-8000-000000000011', 'Pezinho',                  'Contorno das laterais e nuca na navalha.',                                                                        15.00,  10, true, 22),

-- ── Pacotes Mensais ──────────────────────────────────────────────────────
('p3000000-0000-4000-8000-000000000001', 'Pacote mensal 1',          'Pacote mensal com corte semanal — ideal para quem corta toda semana.',                                           120.00,  40, true, 23),
('p3000000-0000-4000-8000-000000000002', 'Pacote mensal 2',          'Pacote mensal com corte + sobrancelha semanais.',                                                                140.00,  40, true, 24),
('p3000000-0000-4000-8000-000000000003', 'Pacote mensal 3',          'Pacote mensal com corte + cavanhaque semanais.',                                                                 160.00,  40, true, 25),
('p3000000-0000-4000-8000-000000000004', 'Pacote mensal 4',          'Pacote mensal completo com corte + barba semanais.',                                                             200.00,  40, true, 26),
('p3000000-0000-4000-8000-000000000005', 'Pacote mensal 5',          'Pacote mensal premium com corte + barboterapia semanais.',                                                       240.00,  60, true, 27);
