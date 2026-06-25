from pydantic import BaseModel, Field
from typing import Optional, List
import datetime

class ClientProfileBase(BaseModel):
    gstin: str
    legal_name: str
    address: str
    arn: Optional[str] = None
    lut_number: Optional[str] = None
    lut_start_date: Optional[datetime.date] = None
    lut_end_date: Optional[datetime.date] = None
    director_name: Optional[str] = None

class ClientProfileCreate(ClientProfileBase):
    pass

class ClientProfileUpdate(ClientProfileBase):
    pass

class ClientProfileResponse(ClientProfileBase):
    id: int

    class Config:
        from_attributes = True

class RefundApplicationBase(BaseModel):
    client_id: int
    period_start: datetime.date
    period_end: datetime.date
    cgst_ledger_balance_end: Optional[float] = 0.0
    sgst_ledger_balance_end: Optional[float] = 0.0
    cgst_ledger_balance_filing: Optional[float] = 0.0
    sgst_ledger_balance_filing: Optional[float] = 0.0
    ledger_buffer_adjustment: Optional[float] = 305000.0

class RefundApplicationCreate(RefundApplicationBase):
    pass

class RefundApplicationResponse(RefundApplicationBase):
    id: int
    status: str
    zero_rated_turnover: float
    adjusted_total_turnover: float
    net_itc: float
    max_refund_allowed: float
    refund_claimed_cgst: float
    refund_claimed_sgst: float

    class Config:
        from_attributes = True

class DashboardSummaryResponse(BaseModel):
    application: RefundApplicationResponse
    client: ClientProfileResponse
    firc_count: int
    invoice_count: int
    purchase_count: int
    firc_gap_count: int
