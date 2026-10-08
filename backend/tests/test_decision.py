from app.services.verification import Decision, evaluate_scans

T = 0.15


def test_fewer_than_three_scans_is_pending():
    assert evaluate_scans([0.7], T) == Decision.PENDING
    assert evaluate_scans([0.7, 0.72], T) == Decision.PENDING


def test_stable_or_rising_is_healthy():
    assert evaluate_scans([0.70, 0.71, 0.72], T) == Decision.HEALTHY
    assert evaluate_scans([0.70, 0.75, 0.80], T) == Decision.HEALTHY


def test_single_unconfirmed_drop_is_withheld():
    assert evaluate_scans([0.75, 0.72, 0.50], T) == Decision.WITHHOLD


def test_drop_confirmed_over_two_scans_is_degraded():
    assert evaluate_scans([0.72, 0.50, 0.40], T) == Decision.DEGRADED


def test_dip_that_recovers_is_healthy():
    assert evaluate_scans([0.75, 0.55, 0.72], T) == Decision.HEALTHY


def test_drop_exactly_at_threshold_is_not_beyond_it():
    assert evaluate_scans([0.75, 0.75, 0.60], T) == Decision.HEALTHY


def test_only_the_latest_window_counts():
    assert evaluate_scans([0.30, 0.31, 0.70, 0.71, 0.72], T) == Decision.HEALTHY