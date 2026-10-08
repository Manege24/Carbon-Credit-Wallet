"""
Scheduled entry point (sequence diagram: 'every 2 months'). Run with:

    python -m app.jobs.run_verification

In production, cron (Linux) or Task Scheduler (Windows) calls this command.
"""
from app.core.database import SessionLocal
import app.models  # noqa: F401  (registers every table)
from app.services.imagery import get_imagery_provider
from app.services.verification import run_verification_cycle


def main() -> None:
    db = SessionLocal()
    try:
        results = run_verification_cycle(db, get_imagery_provider())
        for r in results:
            print(f"{r.plot_id}  {r.outcome:<20} ndvi={r.ndvi_value}  issued={r.tokens_issued_kg}  revoked={r.tokens_revoked}")
        print(f"Done - {len(results)} plot(s) processed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()