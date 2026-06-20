use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct LeaderboardSnapshotRecord {
    pub id: Uuid,
    pub label: String,
    pub entity_type: String,
    pub built_by: Option<Uuid>,
    pub built_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct LeaderboardEntryRecord {
    pub id: Uuid,
    pub snapshot_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub entity_name: String,
    pub entity_slug: String,
    pub rank: i32,
    pub points: i32,
    pub wins: i32,
    pub losses: i32,
    pub draws: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow)]
pub struct EntityStatsRow {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub points: i64,
    pub wins: i64,
    pub losses: i64,
    pub draws: i64,
}

pub async fn get_latest_snapshot(
    pool: &PgPool,
    entity_type: &str,
) -> Result<Option<LeaderboardSnapshotRecord>, sqlx::Error> {
    sqlx::query_as::<_, LeaderboardSnapshotRecord>(
        r#"
        SELECT id, label, entity_type, built_by, built_at
        FROM leaderboard_snapshots
        WHERE entity_type = $1
        ORDER BY built_at DESC
        LIMIT 1
        "#,
    )
    .bind(entity_type)
    .fetch_optional(pool)
    .await
}

pub async fn list_entries_for_snapshot(
    pool: &PgPool,
    snapshot_id: Uuid,
) -> Result<Vec<LeaderboardEntryRecord>, sqlx::Error> {
    sqlx::query_as::<_, LeaderboardEntryRecord>(
        r#"
        SELECT id, snapshot_id, entity_type, entity_id, entity_name, entity_slug,
               rank, points, wins, losses, draws, created_at
        FROM leaderboard_entries
        WHERE snapshot_id = $1
        ORDER BY rank ASC
        "#,
    )
    .bind(snapshot_id)
    .fetch_all(pool)
    .await
}

pub async fn create_snapshot(
    pool: &PgPool,
    label: &str,
    entity_type: &str,
    built_by: Uuid,
) -> Result<LeaderboardSnapshotRecord, sqlx::Error> {
    sqlx::query_as::<_, LeaderboardSnapshotRecord>(
        r#"
        INSERT INTO leaderboard_snapshots (id, label, entity_type, built_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, label, entity_type, built_by, built_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(label)
    .bind(entity_type)
    .bind(built_by)
    .fetch_one(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_entry(
    pool: &PgPool,
    snapshot_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
    entity_name: &str,
    entity_slug: &str,
    rank: i32,
    points: i32,
    wins: i32,
    losses: i32,
    draws: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO leaderboard_entries
            (id, snapshot_id, entity_type, entity_id, entity_name, entity_slug,
             rank, points, wins, losses, draws)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(snapshot_id)
    .bind(entity_type)
    .bind(entity_id)
    .bind(entity_name)
    .bind(entity_slug)
    .bind(rank)
    .bind(points)
    .bind(wins)
    .bind(losses)
    .bind(draws)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn aggregate_team_stats(pool: &PgPool) -> Result<Vec<EntityStatsRow>, sqlx::Error> {
    sqlx::query_as::<_, EntityStatsRow>(
        r#"
        SELECT t.id, t.name, t.slug,
               COALESCE(SUM(s.points), 0) AS points,
               COALESCE(SUM(s.wins),   0) AS wins,
               COALESCE(SUM(s.losses), 0) AS losses,
               COALESCE(SUM(s.draws),  0) AS draws
        FROM teams t
        LEFT JOIN team_stats s ON s.team_id = t.id
        WHERE t.is_active = TRUE
        GROUP BY t.id, t.name, t.slug
        ORDER BY points DESC, t.name ASC
        "#,
    )
    .fetch_all(pool)
    .await
}

pub async fn aggregate_player_stats(pool: &PgPool) -> Result<Vec<EntityStatsRow>, sqlx::Error> {
    sqlx::query_as::<_, EntityStatsRow>(
        r#"
        SELECT p.id, p.name, p.slug,
               COALESCE(SUM(s.points), 0) AS points,
               COALESCE(SUM(s.wins),   0) AS wins,
               COALESCE(SUM(s.losses), 0) AS losses,
               COALESCE(SUM(s.draws),  0) AS draws
        FROM players p
        LEFT JOIN player_stats s ON s.player_id = p.id
        WHERE p.is_active = TRUE
        GROUP BY p.id, p.name, p.slug
        ORDER BY points DESC, p.name ASC
        "#,
    )
    .fetch_all(pool)
    .await
}
