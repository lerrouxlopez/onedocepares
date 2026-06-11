use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, FromRow, Serialize)]
pub struct UserRecord {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub password_hash: String,
    pub is_active: bool,
    pub roles: Vec<String>,
}

#[derive(Clone, Debug, FromRow)]
pub struct SessionRecord {
    pub user_id: Uuid,
    pub token_hash: String,
    pub csrf_token: String,
}

#[derive(Clone, Debug)]
pub struct NewSession<'a> {
    pub user_id: Uuid,
    pub token_hash: &'a str,
    pub csrf_token: &'a str,
    pub expires_at: DateTime<Utc>,
    pub user_agent: Option<&'a str>,
    pub ip_address: Option<&'a str>,
}

pub async fn find_user_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<UserRecord>, sqlx::Error> {
    sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT
            u.id,
            u.email,
            u.display_name,
            u.password_hash,
            u.is_active,
            COALESCE(array_remove(array_agg(r.code), NULL), '{}') AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE lower(u.email) = lower($1)
        GROUP BY u.id
        "#,
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn find_user_by_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<UserRecord>, sqlx::Error> {
    sqlx::query_as::<_, UserRecord>(
        r#"
        SELECT
            u.id,
            u.email,
            u.display_name,
            u.password_hash,
            u.is_active,
            COALESCE(array_remove(array_agg(r.code), NULL), '{}') AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = $1
        GROUP BY u.id
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

pub async fn insert_session(pool: &PgPool, session: &NewSession<'_>) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, user_agent, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(session.user_id)
    .bind(session.token_hash)
    .bind(session.csrf_token)
    .bind(session.expires_at)
    .bind(session.user_agent)
    .bind(session.ip_address)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn find_session_by_hash(
    pool: &PgPool,
    token_hash: &str,
) -> Result<Option<SessionRecord>, sqlx::Error> {
    sqlx::query_as::<_, SessionRecord>(
        r#"
        SELECT user_id, token_hash, csrf_token
        FROM sessions
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
        "#,
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
}

pub async fn revoke_session(pool: &PgPool, token_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE sessions
        SET revoked_at = now()
        WHERE token_hash = $1
        "#,
    )
    .bind(token_hash)
    .execute(pool)
    .await
    .map(|_| ())
}
