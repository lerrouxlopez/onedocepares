use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct FollowRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct LikeRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub feed_item_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct CommentRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub feed_item_id: Uuid,
    pub body: String,
    pub status: String,
    pub reviewed_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ─── Follows ────────────────────────────────────────────────────────────────

pub async fn follow(
    pool: &PgPool,
    user_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<FollowRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO follows (id, user_id, entity_type, entity_id) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(user_id)
    .bind(entity_type)
    .bind(entity_id)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, FollowRecord>("SELECT * FROM follows WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn unfollow(
    pool: &PgPool,
    user_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let rows = sqlx::query(
        "DELETE FROM follows WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3",
    )
    .bind(user_id)
    .bind(entity_type)
    .bind(entity_id)
    .execute(pool)
    .await?
    .rows_affected();
    Ok(rows > 0)
}

pub async fn get_follow_count(
    pool: &PgPool,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<i64, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM follows WHERE entity_type = $1 AND entity_id = $2",
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_one(pool)
    .await?;
    Ok(count)
}

pub async fn is_following(
    pool: &PgPool,
    user_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM follows WHERE user_id=$1 AND entity_type=$2 AND entity_id=$3)",
    )
    .bind(user_id)
    .bind(entity_type)
    .bind(entity_id)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

// ─── Likes ──────────────────────────────────────────────────────────────────

pub async fn like_feed_item(
    pool: &PgPool,
    user_id: Uuid,
    feed_item_id: Uuid,
) -> Result<LikeRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO likes (id, user_id, feed_item_id) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(user_id)
        .bind(feed_item_id)
        .execute(pool)
        .await?;

    sqlx::query_as::<_, LikeRecord>("SELECT * FROM likes WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn unlike_feed_item(
    pool: &PgPool,
    user_id: Uuid,
    feed_item_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let rows = sqlx::query("DELETE FROM likes WHERE user_id = $1 AND feed_item_id = $2")
        .bind(user_id)
        .bind(feed_item_id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(rows > 0)
}

pub async fn get_like_count(pool: &PgPool, feed_item_id: Uuid) -> Result<i64, sqlx::Error> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM likes WHERE feed_item_id = $1")
        .bind(feed_item_id)
        .fetch_one(pool)
        .await?;
    Ok(count)
}

pub async fn is_liked(
    pool: &PgPool,
    user_id: Uuid,
    feed_item_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM likes WHERE user_id=$1 AND feed_item_id=$2)",
    )
    .bind(user_id)
    .bind(feed_item_id)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

// ─── Comments ───────────────────────────────────────────────────────────────

pub async fn create_comment(
    pool: &PgPool,
    user_id: Uuid,
    feed_item_id: Uuid,
    body: &str,
) -> Result<CommentRecord, sqlx::Error> {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO comments (id, user_id, feed_item_id, body) VALUES ($1, $2, $3, $4)")
        .bind(id)
        .bind(user_id)
        .bind(feed_item_id)
        .bind(body)
        .execute(pool)
        .await?;

    sqlx::query_as::<_, CommentRecord>("SELECT * FROM comments WHERE id = $1")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn list_approved_comments(
    pool: &PgPool,
    feed_item_id: Uuid,
) -> Result<Vec<CommentRecord>, sqlx::Error> {
    sqlx::query_as::<_, CommentRecord>(
        "SELECT * FROM comments WHERE feed_item_id = $1 AND status = 'approved' ORDER BY created_at ASC",
    )
    .bind(feed_item_id)
    .fetch_all(pool)
    .await
}

pub async fn list_pending_comments(pool: &PgPool) -> Result<Vec<CommentRecord>, sqlx::Error> {
    sqlx::query_as::<_, CommentRecord>(
        "SELECT * FROM comments WHERE status = 'pending' ORDER BY created_at ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn update_comment_status(
    pool: &PgPool,
    id: Uuid,
    status: &str,
    reviewed_by: Uuid,
) -> Result<Option<CommentRecord>, sqlx::Error> {
    let rows =
        sqlx::query("UPDATE comments SET status=$2, reviewed_by=$3, updated_at=now() WHERE id=$1")
            .bind(id)
            .bind(status)
            .bind(reviewed_by)
            .execute(pool)
            .await?
            .rows_affected();

    if rows == 0 {
        return Ok(None);
    }
    sqlx::query_as::<_, CommentRecord>("SELECT * FROM comments WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}
