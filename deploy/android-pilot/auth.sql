CREATE TABLE public.users (
    id bigserial PRIMARY KEY,
    name varchar(255) NOT NULL,
    email varchar(255) UNIQUE NOT NULL,
    email_verified_at timestamp,
    password varchar(255) NOT NULL,
    remember_token varchar(100),
    canonical_user_account_id bigint UNIQUE REFERENCES jairoads_next.user_accounts(id),
    user_account_id bigint,
    two_factor_secret text,
    two_factor_recovery_codes text,
    two_factor_confirmed_at timestamp,
    created_at timestamp,
    updated_at timestamp
);

CREATE TABLE public.password_reset_tokens (
    email varchar(255) PRIMARY KEY,
    token varchar(255) NOT NULL,
    created_at timestamp
);

CREATE TABLE public.passkeys (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    credential_id varchar(255) NOT NULL UNIQUE,
    credential json NOT NULL,
    last_used_at timestamp,
    created_at timestamp,
    updated_at timestamp
);
