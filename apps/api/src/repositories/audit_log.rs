use sqlx::PgPool;
use uuid::Uuid;

pub async fn insert_audit(
    pool: &PgPool,
    user_id: Uuid,
    action: &str,
    entity_type: Option<&str>,
    entity_id: Option<Uuid>,
    details: Option<serde_json::Value>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(details)
    .execute(pool)
    .await?;
    Ok(())
}
