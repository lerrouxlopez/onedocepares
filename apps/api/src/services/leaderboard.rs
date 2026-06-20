use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::leaderboards::{self, LeaderboardSnapshotRecord};

pub async fn rebuild_team_leaderboard(
    pool: &PgPool,
    label: &str,
    actor_id: Uuid,
) -> Result<LeaderboardSnapshotRecord, sqlx::Error> {
    let rows = leaderboards::aggregate_team_stats(pool).await?;
    let snapshot = leaderboards::create_snapshot(pool, label, "team", actor_id).await?;
    for (i, row) in rows.iter().enumerate() {
        leaderboards::insert_entry(
            pool,
            snapshot.id,
            "team",
            row.id,
            &row.name,
            &row.slug,
            i as i32 + 1,
            row.points as i32,
            row.wins as i32,
            row.losses as i32,
            row.draws as i32,
        )
        .await?;
    }
    Ok(snapshot)
}

pub async fn rebuild_player_leaderboard(
    pool: &PgPool,
    label: &str,
    actor_id: Uuid,
) -> Result<LeaderboardSnapshotRecord, sqlx::Error> {
    let rows = leaderboards::aggregate_player_stats(pool).await?;
    let snapshot = leaderboards::create_snapshot(pool, label, "player", actor_id).await?;
    for (i, row) in rows.iter().enumerate() {
        leaderboards::insert_entry(
            pool,
            snapshot.id,
            "player",
            row.id,
            &row.name,
            &row.slug,
            i as i32 + 1,
            row.points as i32,
            row.wins as i32,
            row.losses as i32,
            row.draws as i32,
        )
        .await?;
    }
    Ok(snapshot)
}
