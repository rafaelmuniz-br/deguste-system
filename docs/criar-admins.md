# Criar os usuários do painel admin (Bruno e Lucas)

O painel `/admin` usa o login do Supabase (e-mail + senha). Ter login **não basta**: a pessoa também precisa estar na tabela `admins`. Quem não está lá entra na conta, mas o banco não devolve nenhum dado (RLS) e a tela mostra "Sem acesso".

Faça isso **uma vez por ambiente** (`deguste-dev` agora; `deguste-prod` perto do go-live). Quem faz: quem administra o projeto no Supabase (Lucas ou Rafael).

## 1. Desligar o cadastro público (faça primeiro)

Por padrão o Supabase deixa qualquer pessoa criar conta usando a chave pública do site. Como só a equipe usa login, desligue:

1. No projeto: **Authentication** → **Sign In / Providers** (ou **Settings**).
2. Desative **Allow new users to sign up**.
3. Salve.

Se um dia os clientes tiverem conta (cashback, tarefa 6.6), este passo será revisto.

## 2. Criar cada usuário

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Informe o e-mail da pessoa e uma senha **forte e única** (gere no gerenciador de senhas).
3. Marque **Auto Confirm User** (senão o Supabase exige clicar num link de e-mail).
4. Repita para cada pessoa (Lucas, Bruno, Rafael, se for usar).

A senha não vai para o chat, para o Git nem para o `.env`. Cada pessoa guarda a sua.

## 3. Liberar como admin

No **SQL Editor** do projeto, troque os e-mails pelos reais e rode:

```sql
insert into public.admins (user_id)
select id from auth.users
where email in ('EMAIL_DO_LUCAS', 'EMAIL_DO_BRUNO')
on conflict do nothing;

-- conferir quem é admin
select u.email
from public.admins a
join auth.users u on u.id = a.user_id;
```

Para **remover** o acesso de alguém:

```sql
delete from public.admins
where user_id = (select id from auth.users where email = 'EMAIL_DA_PESSOA');
```

## 4. Testar

1. Abra `/admin` (em dev: <http://localhost:5173/admin>).
2. Entre com o e-mail e a senha. Deve aparecer "Logado como ...".
3. Teste também uma conta que **não** está em `admins`: deve aparecer "Sem acesso".

## Segurança

- A chave `anon` (pública) é a única que vai para o navegador. **Nunca** use a `service_role` no app.
- Ative a verificação em duas etapas (2FA) na conta do Supabase de quem administra o projeto (tarefa 5.9 do plano).
- Trocou de pessoa na equipe? Remova de `admins` **e** apague o usuário em Authentication → Users.
