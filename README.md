# Ziack

Loja virtual de joias com uma identidade visual editorial e elegante. Projeto inicial desenvolvido com Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM e Docker Compose.

## Requisitos

- Node.js 22 ou superior
- Docker Engine e Docker Compose
- npm

## Desenvolvimento local

1. Copie `.env.example` para `.env` e substitua `ADMIN_PASSWORD` por uma senha local forte e `AUTH_SECRET` por um segredo aleatório com pelo menos 32 caracteres.
2. Suba o PostgreSQL: `docker compose up -d db`.
3. Instale dependências com `npm install`.
4. Gere o cliente do Prisma: `npm run db:generate`.
5. Crie/aplique a estrutura do banco: `npm run db:migrate`.
6. Insira os produtos de demonstração e crie a conta de admin: `npm run db:seed`.
7. Inicie o Next.js com `npm run dev` e acesse `http://localhost:3000`.

A vitrine fica em `/`, os detalhes em `/produto/[slug]`, o login administrativo em `/admin-login` e o painel protegido em `/admin`. O gerenciamento de produtos fica em `/admin/produtos`.

## Docker

Copie `.env.example` para `.env`, substitua as senhas/segredos e então execute `docker compose up --build`. A aplicação e o PostgreSQL serão iniciados na porta 3000; no início, o container sincroniza o schema de demonstração e cria a conta/admin e o catálogo seed. Para desenvolvimento com hot reload e migrações versionadas, use o fluxo local acima e mantenha apenas o serviço `db` no Docker. O uso de `prisma db push` no Compose é voltado a desenvolvimento/demonstração; prepare e revise migrações antes de produção.

## Scripts

- `npm run dev` — servidor de desenvolvimento.
- `npm run lint` — análise estática ESLint.
- `npm run build` — build de produção.
- `npm run db:generate` — gerar o Prisma Client.
- `npm run db:migrate` — criar/aplicar migrações locais.
- `npm run db:seed` — criar usuário administrador e catálogo demonstrativo.

## Estrutura

- `src/app` — páginas e rotas do Next.js, incluindo login e painel.
- `src/components` — componentes da loja.
- `src/lib` — catálogo, autenticação e cliente do Prisma.
- `prisma/schema.prisma` — modelos de usuários, categorias, produtos, pedidos e itens.
- `prisma/seed.ts` — usuário e catálogo iniciais.
- `Dockerfile` e `docker-compose.yml` — aplicação e PostgreSQL.

## Estado e próximos passos

A vitrine responsiva inclui busca/filtros, páginas de produto e sacola de demonstração. O painel tem autenticação por senha hash e sessão assinada, com cadastro, edição, ativação e exclusão persistente de produtos. Os indicadores e pedidos do dashboard ainda são dados demonstrativos.

O checkout com pagamento real, gestão de pedidos/clientes, integração de frete, notificações por e-mail, armazenamento de imagens e testes automatizados são etapas seguintes antes de operar ou publicar a loja. Não há credenciais ou serviços de pagamento reais configurados. Troque as senhas e segredos locais antes de qualquer implantação.
