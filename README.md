# Barbearia 49 Smart Bookings

O nome da Barbearia é "Barbearia 49". O único barbeiro é o Isac, especialista em cortes.

Crie um sistema completo de agendamento e gestão para a Barbearia 49 com 2 tipos de usuário: CLIENTE e DONO (Isac).

Diretrizes e regras acordadas:
- Confirmação automática de agendamento: o horário livre escolhido é confirmado imediatamente, pois a agenda em tempo real bloqueia automaticamente os horários ocupados.
- Fluxo do Cliente (mobile-first e sem atrito):
  • O cliente pode navegar pelos serviços, escolher data e horário livre sem precisar fazer login antes.
  • Para finalizar o agendamento, informa apenas: Nome, Telefone com DDD e Apelido (opcional).
  • O número de celular é o identificador único (se for primeira vez cadastra automaticamente; se já existir, vincula direto).
  • Confirmação imediata com tela de sucesso, resumo do corte e link/botão para WhatsApp para enviar a confirmação e facilitar lembretes.
  • Histórico de cortes, remarcar/cancelar agendamento, programa de fidelidade (a cada 10 cortes, 1 grátis), avaliação pós-atendimento e lista de espera caso um dia esteja lotado.
- Painel Administrativo do Dono (Isac):
  • Login com e-mail e senha.
  • Agenda visual completa estilo Google Calendar (dia, semana e mês).
  • Lista de agendamentos com ação rápida para abrir conversa no WhatsApp com mensagem de lembrete pronta.
  • Gestão de serviços cadastrados com exemplos iniciais realistas (cortes, barba, combos com preço e duração em minutos), permitindo criar e editar.
  • Gestão de horários de atendimento, dias de funcionamento, pausa de almoço e bloqueios pontuais (folga, feriado).
  • Dashboard com métricas: faturamento (dia/semana/mês), ticket médio, taxa de ocupação, cancelamentos/no-show, serviços mais pedidos, clientes inativos (+30 dias) e taxa de novos vs recorrentes.
- Interface: Moderna, visual escuro sofisticado estilo barbearia premium, 100% responsiva e em Português do Brasil.
- Banco de dados e backend em Supabase / Lovable Cloud estruturando tabelas de perfis, serviços, agendamentos, lista de espera, avaliações e fidelidade.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0bc8aacf-2831-4799-b290-3368129fb6a6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
