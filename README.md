# Ziack

Loja virtual de joias com uma identidade visual editorial e elegante. Projeto inicial desenvolvido com Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM e Docker Compose.

## Requisitos

- Node.js 22 ou superior
- Docker Engine e Docker Compose
- npm

## Desenvolvimento local

1. Copie `.env.example` para `.env` e substitua `ADMIN_PASSWORD` por uma senha local forte e `AUTH_SECRET` por um segredo aleatório com pelo menos 32 caracteres. Para pagamentos de teste, configure também as variáveis do Mercado Pago listadas abaixo.
2. Suba o PostgreSQL: `docker compose up -d db`.
3. Instale dependências com `npm install`.
4. Gere o cliente do Prisma: `npm run db:generate`.
5. Crie/aplique a estrutura do banco: `npm run db:migrate`.
6. Insira os produtos de demonstração e crie a conta de admin: `npm run db:seed`.
7. Inicie o Next.js com `npm run dev` e acesse `http://localhost:3000`.

A vitrine fica em `/`, os detalhes em `/produto/[slug]`, o checkout em `/checkout`, o login administrativo em `/admin-login` e o painel protegido em `/admin`. O painel mantém a navegação lateral em Produtos (`/admin/produtos`), Categorias (`/admin/categorias`) e Cupons de parceiros (`/admin/cupons`), além das demais áreas administrativas.

## Docker

Para produção, configure `.env` no servidor com senhas/segredos fortes e `APP_URL` apontando para o domínio HTTPS. O container aplica migrações versionadas (`prisma migrate deploy`) antes de iniciar. Na primeira implantação, crie o administrador e o catálogo inicial explicitamente com `docker compose run --rm app npx prisma db seed`; não execute o seed a cada reinício, pois ele redefine a senha do administrador para o valor em `ADMIN_PASSWORD`.

O PostgreSQL fica apenas na rede interna do Docker, sem porta publicada no host. O Next.js é publicado somente em `127.0.0.1:3000` e deve ficar atrás de um proxy reverso HTTPS, como Nginx. Os volumes `ziack_postgres_data` e `ziack_product_uploads` preservam banco e imagens, mas não substituem backups externos. Use `sudo docker compose up -d --build` para iniciar e `sudo docker compose logs -f app` para acompanhar os logs.

Para desenvolvimento com hot reload, use o fluxo local acima e mantenha apenas o serviço `db` no Docker.

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

A vitrine responsiva inclui busca/filtros, páginas de produto e sacola persistida no navegador. O checkout valida preços e estoque no servidor e reserva as unidades solicitadas. Sem credenciais do Mercado Pago, continua em modo demonstrativo e não processa pagamentos. Com Checkout Pro configurado, cria uma preferência de pagamento e redireciona o cliente ao Mercado Pago; o frete precisa estar configurado para que exista um total final antes da cobrança.

O painel protegido mantém a navegação lateral compartilhada e destaca a seção ativa. Pedidos do Mercado Pago só avançam para “Pagamento recebido” após notificação assinada e consulta do pagamento diretamente à API; o retorno do navegador nunca confirma pagamento. Pedidos demonstrativos continuam usando a confirmação manual explícita, sem processamento de transação. Produtos aceitam imagens JPEG, PNG e WebP de até 5 MB; os arquivos ficam em `data/uploads` no desenvolvimento e em um volume Docker persistente. Peso embalado em quilogramas e largura, altura e comprimento em centímetros são obrigatórios ao cadastrar e editar produtos, para permitir cotações do Melhor Envio; os campos permanecem opcionais no banco apenas para preservar produtos antigos até seu preenchimento. Produtos ativos sem estoque permanecem na vitrine com o aviso de indisponibilidade, mas não podem ser adicionados à sacola; o checkout também revalida o estoque no servidor. O dashboard lista alertas de reposição para produtos ativos com cinco unidades ou menos. Categorias podem ser criadas, renomeadas e desativadas; uma categoria com produtos ativos não pode ser desativada. Cupons de parceiros aceitam desconto percentual ou fixo, período de validade, pedido mínimo e limite de usos; o checkout valida tudo no servidor, contabiliza o uso atomicamente e grava o código e o desconto no pedido. Troque as senhas e segredos locais antes de qualquer implantação.

### Cotações Melhor Envio

1. Cadastre o aplicativo Ziack na Área Dev do Melhor Envio. Configure a callback exatamente como `https://SEU-DOMINIO/api/integrations/melhor-envio/callback` e habilite o escopo `shipping-calculate`.
2. No servidor, configure `MELHORENVIO_MODE` (`sandbox` ou `production`), `MELHORENVIO_CLIENT_ID`, `MELHORENVIO_CLIENT_SECRET`, `MELHORENVIO_REDIRECT_URI` (idêntica à callback cadastrada) e `MELHORENVIO_TOKEN_ENCRYPTION_KEY`. Gere a chave de criptografia com `openssl rand -hex 32`; mantenha a mesma chave e os tokens persistidos em backups seguros. Configure também `APP_URL` com o endereço público e `MELHORENVIO_CONTACT_EMAIL` ou e-mail de contato nas configurações da loja.
3. Acesse `/admin/configuracoes`, informe o CEP de origem e conecte a conta Melhor Envio da Ziack pelo OAuth. Access/refresh tokens ficam criptografados no banco; o sistema renova os tokens expirados no servidor.
4. Preencha o peso já embalado (kg) e as dimensões da embalagem (cm) de cada produto, incluindo os produtos antigos.
5. No checkout, o cliente informa o CEP de destino, consulta as opções do Melhor Envio e seleciona serviço/preço/prazo. O preço personalizado da cotação é conferido e salvo com o pedido; a cotação expira após 10 minutos. A integração consulta fretes, mas não compra etiquetas.

### Mercado Pago Checkout Pro

1. Configure `MERCADOPAGO_MODE=sandbox` e o Access Token de teste exibido na aplicação do Mercado Pago. O validador aceita os formatos `TEST-` e `APP_USR-`; confirme no painel que a credencial pertence ao ambiente de teste. Nunca coloque credenciais no código nem as envie pelo chat.
2. Configure `APP_URL` com a URL da loja e crie um endpoint HTTPS público para `/api/webhooks/mercado-pago` (por exemplo, por um túnel de desenvolvimento). Em `.env`, defina `MERCADOPAGO_WEBHOOK_URL` com essa URL completa e `MERCADOPAGO_WEBHOOK_SECRET` com a chave secreta de assinatura disponibilizada nas configurações de Webhooks do Mercado Pago.
3. Configure o webhook no painel do Mercado Pago para eventos de pagamentos e use a mesma URL e chave. O endpoint valida a assinatura HMAC, consulta o pagamento pela API e confere o pedido, valor, moeda e ambiente antes de atualizar o status.
4. Em `/admin/configuracoes`, informe o frete ou configure uma condição de frete grátis aplicável. O checkout bloqueia pagamentos se o frete/total não puder ser calculado.
5. Acesse `/checkout` e use os meios de pagamento de teste indicados pelo Mercado Pago. O pedido fica pendente até a confirmação do webhook; URLs de retorno do navegador são apenas informativas.

Para produção, use `MERCADOPAGO_MODE=production`, um token `APP_USR-...`, `APP_URL` HTTPS público e endpoint de webhook HTTPS com segredo configurado. Não habilite cobranças reais antes de validar o webhook no ambiente de produção. Preferências expiram após 30 minutos; o cancelamento administrativo de pedidos Mercado Pago encerra a preferência e consulta as tentativas antes de liberar estoque.
