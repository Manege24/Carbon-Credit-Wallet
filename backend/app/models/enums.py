import enum


class AccountStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    deactivated = "deactivated"


class PlotStatus(str, enum.Enum):
    active = "active"
    degraded = "degraded"
    archived = "archived"


class TokenStatus(str, enum.Enum):
    issued = "issued"
    purchased = "purchased"
    revoked = "revoked"


class EntryType(str, enum.Enum):
    issuance = "issuance"
    revocation = "revocation"
    purchase = "purchase"


class AccountRole(str, enum.Enum):
    buyer = "BUYER"
    admin = "ADMIN"