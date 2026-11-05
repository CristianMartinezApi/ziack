# Ziack — diretrizes do projeto

- E-commerce de joias em pt-BR; manter identidade editorial, premium, responsiva e acessível.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM e Docker Compose.
- Proteger rotas e ações administrativas com sessão validada no servidor; validar entradas com Zod.
- Nunca registrar credenciais ou segredos reais. Usar variáveis de ambiente e manter `.env` fora do controle de versão.
- Exibir valores em BRL e manter estados de vazio, erro e confirmação.
- Executar `npm run lint` e `npm run build` após alterações importantes; manter o README atualizado.
