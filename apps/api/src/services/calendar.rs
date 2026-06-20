use chrono::Utc;

use crate::repositories::tournaments::TournamentRecord;

pub fn tournament_to_ics(tournament: &TournamentRecord) -> String {
    let now = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let uid = format!("tournament-{}@onedocepares.com", tournament.id);
    let summary = escape_ics_text(&tournament.name);
    let description = tournament
        .description
        .as_deref()
        .map(escape_ics_text)
        .unwrap_or_default();
    let location = tournament
        .location
        .as_deref()
        .map(escape_ics_text)
        .unwrap_or_default();

    let dtstart = tournament
        .start_date
        .map(|d| d.format("%Y%m%d").to_string())
        .unwrap_or_else(|| "19700101".to_string());

    let dtend = tournament
        .end_date
        .map(|d| (d + chrono::Duration::days(1)).format("%Y%m%d").to_string())
        .or_else(|| {
            tournament
                .start_date
                .map(|d| (d + chrono::Duration::days(1)).format("%Y%m%d").to_string())
        })
        .unwrap_or_else(|| "19700102".to_string());

    let url = format!(
        "https://onedocepares.com/tournament.html?slug={}",
        tournament.slug
    );

    format!(
        "BEGIN:VEVENT\r\nUID:{uid}\r\nDTSTAMP:{now}\r\nDTSTART;VALUE=DATE:{dtstart}\r\nDTEND;VALUE=DATE:{dtend}\r\nSUMMARY:{summary}\r\nDESCRIPTION:{description}\r\nLOCATION:{location}\r\nURL:{url}\r\nEND:VEVENT"
    )
}

pub fn tournaments_to_ics(tournaments: &[TournamentRecord]) -> String {
    let events: Vec<String> = tournaments.iter().map(tournament_to_ics).collect();
    format!(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//One Doce Pares//ODP Platform//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:One Doce Pares Tournaments\r\n{}\r\nEND:VCALENDAR",
        events.join("\r\n")
    )
}

pub fn single_tournament_ics(tournament: &TournamentRecord) -> String {
    format!(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//One Doce Pares//ODP Platform//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n{}\r\nEND:VCALENDAR",
        tournament_to_ics(tournament)
    )
}

fn escape_ics_text(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace('\n', "\\n")
        .replace('\r', "")
}
