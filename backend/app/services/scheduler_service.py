from apscheduler.schedulers.background import BackgroundScheduler
from app.db.database import SessionLocal, run
from app.services.notification_service import NotificationService

_notif = NotificationService()

def check_reminders():
    """Runs daily at 9am. Sends Teams alerts for due-soon and overdue tasks."""
    db = SessionLocal()
    try:
        # Tasks due in exactly 2 days
        soon = run(db, """
            SELECT id, todo, assigned_to, due_date, entity
            FROM ops_QM.fact_adj_task
            WHERE status IN ('open','inprog')
              AND due_date = CURDATE() + INTERVAL 2 DAY
        """, {})
        for t in soon:
            _notif.notify_due_soon(
                todo=t['todo'],
                assignee=t['assigned_to'],
                due_date=str(t['due_date']),
                entity=t['entity']
            )

        # Tasks already overdue
        overdue = run(db, """
            SELECT t.id, t.todo, t.assigned_to, t.due_date, t.entity,
                   GROUP_CONCAT(u.user_id) AS manager_ids
            FROM ops_QM.fact_adj_task t
            LEFT JOIN ops_QM.users u ON u.role='manager' AND u.is_active=1
            WHERE t.status IN ('open','inprog')
              AND t.due_date < CURDATE()
            GROUP BY t.id
        """, {})
        for t in overdue:
            _notif.notify_overdue(
                todo=t['todo'],
                assignee=t['assigned_to'],
                due_date=str(t['due_date']),
                entity=t['entity']
            )
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run check_reminders every day at 9:00am
    scheduler.add_job(check_reminders, 'cron', hour=9, minute=0)
    scheduler.start()
    return scheduler