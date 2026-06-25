from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, Date, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from .config import DATABASE_URL
import datetime

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ClientProfile(Base):
    __tablename__ = "client_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    gstin = Column(String, unique=True, index=True, nullable=False)
    legal_name = Column(String, nullable=False)
    address = Column(Text, nullable=False)
    arn = Column(String, nullable=True) # Current ARN
    lut_number = Column(String, nullable=True)
    lut_start_date = Column(Date, nullable=True)
    lut_end_date = Column(Date, nullable=True)
    director_name = Column(String, nullable=True)
    
    applications = relationship("RefundApplication", back_populates="client")

class RefundApplication(Base):
    __tablename__ = "refund_applications"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id"), nullable=False)
    period_start = Column(Date, nullable=False) # e.g. 2025-10-01
    period_end = Column(Date, nullable=False)   # e.g. 2025-12-31
    status = Column(String, default="Draft") # Draft, Reconciled, Generated, Completed
    
    # Ledger balances
    cgst_ledger_balance_end = Column(Float, default=0.0)
    sgst_ledger_balance_end = Column(Float, default=0.0)
    cgst_ledger_balance_filing = Column(Float, default=0.0)
    sgst_ledger_balance_filing = Column(Float, default=0.0)
    
    # Custom adjustment buffer (e.g. 305,000 each)
    ledger_buffer_adjustment = Column(Float, default=305000.0)
    
    # Computed metrics
    zero_rated_turnover = Column(Float, default=0.0)
    adjusted_total_turnover = Column(Float, default=0.0)
    net_itc = Column(Float, default=0.0)
    max_refund_allowed = Column(Float, default=0.0)
    refund_claimed_cgst = Column(Float, default=0.0)
    refund_claimed_sgst = Column(Float, default=0.0)
    
    client = relationship("ClientProfile", back_populates="applications")
    invoices = relationship("Invoice", back_populates="application", cascade="all, delete-orphan")
    fircs = relationship("FircRecord", back_populates="application", cascade="all, delete-orphan")
    purchases = relationship("PurchaseRecord", back_populates="application", cascade="all, delete-orphan")
    gstr2b_records = relationship("Gstr2BRecord", back_populates="application", cascade="all, delete-orphan")

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("refund_applications.id"), nullable=False)
    
    month = Column(String, nullable=True) # e.g. "45931" or "2025-10"
    invoice_no = Column(String, index=True, nullable=False)
    invoice_date = Column(Date, nullable=False)
    customer_name = Column(String, nullable=False)
    type_of_supply = Column(String, nullable=False) # e.g. B2B, Export - Without payment of tax, Exempted, Credit Note
    place_of_supply = Column(String, nullable=True)
    gstin = Column(String, nullable=True)
    hsn_sac = Column(String, nullable=True)
    currency = Column(String, nullable=True) # USD, JPY, EUR etc.
    exchange_rate = Column(Float, nullable=True)
    amt_foreign_currency = Column(Float, nullable=True)
    taxable_value = Column(Float, nullable=False)
    rate = Column(Float, default=0.0)
    igst = Column(Float, default=0.0)
    cgst = Column(Float, default=0.0)
    sgst = Column(Float, default=0.0)
    invoice_value = Column(Float, nullable=True)
    
    # Matching status
    is_reconciled = Column(Boolean, default=False)
    exclude_from_matching = Column(Boolean, default=False)
    
    application = relationship("RefundApplication", back_populates="invoices")
    reconciliation_details = relationship("ReconciliationDetail", back_populates="invoice", cascade="all, delete-orphan")

class FircRecord(Base):
    __tablename__ = "firc_records"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("refund_applications.id"), nullable=False)
    
    firc_no = Column(String, index=True, nullable=False)
    firc_date = Column(Date, nullable=False)
    currency = Column(String, nullable=False)
    amount_foreign = Column(Float, nullable=False)
    amount_inr = Column(Float, nullable=False)
    bank_name = Column(String, nullable=True)
    rate = Column(Float, nullable=True)
    remarks = Column(String, default="Not utilized") # Utilised, Partially used, Not utilized
    
    # Track usage in Python
    remaining_amount_foreign = Column(Float, nullable=True)
    
    application = relationship("RefundApplication", back_populates="fircs")
    reconciliation_details = relationship("ReconciliationDetail", back_populates="firc", cascade="all, delete-orphan")

class ReconciliationDetail(Base):
    __tablename__ = "reconciliation_details"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    firc_id = Column(Integer, ForeignKey("firc_records.id"), nullable=False)
    
    firc_amount_used_fc = Column(Float, nullable=False) # Foreign currency amount consumed
    rate_used = Column(Float, nullable=False) # Exchange rate of the FIRC
    collection_amount_inr = Column(Float, nullable=False) # INR value matched
    
    invoice = relationship("Invoice", back_populates="reconciliation_details")
    firc = relationship("FircRecord", back_populates="reconciliation_details")

class PurchaseRecord(Base):
    __tablename__ = "purchase_records"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("refund_applications.id"), nullable=False)
    
    month = Column(String, nullable=True)
    gstin_supplier = Column(String, index=True, nullable=True) # Can be IMPS, RCM, or regular GSTIN
    trade_name = Column(String, nullable=True)
    invoice_number = Column(String, index=True, nullable=False)
    invoice_date = Column(Date, nullable=False)
    rate = Column(Float, default=0.0)
    invoice_value = Column(Float, default=0.0)
    taxable_value = Column(Float, default=0.0)
    igst = Column(Float, default=0.0)
    cgst = Column(Float, default=0.0)
    sgst = Column(Float, default=0.0)
    total_tax = Column(Float, default=0.0)
    hsn_code = Column(String, nullable=True)
    description = Column(String, nullable=True)
    
    # Additional flags after cleaning
    is_import = Column(Boolean, default=False) # GSTIN = IMPS
    is_rcm = Column(Boolean, default=False)    # GSTIN = RCM
    eligibility = Column(String, default="Yes") # Yes, No, Partially
    
    # 2B Matching results
    gstr_2b_month = Column(String, nullable=True)
    gstr_2b_sn = Column(String, nullable=True)
    is_matched_2b = Column(Boolean, default=False)
    
    application = relationship("RefundApplication", back_populates="purchases")

class Gstr2BRecord(Base):
    __tablename__ = "gstr2b_records"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("refund_applications.id"), nullable=False)
    
    type = Column(String, nullable=True) # B2B, RCM, etc.
    gstin_supplier = Column(String, nullable=False)
    trade_name = Column(String, nullable=True)
    invoice_number = Column(String, nullable=False)
    invoice_date = Column(Date, nullable=False)
    invoice_value = Column(Float, default=0.0)
    taxable_value = Column(Float, default=0.0)
    igst = Column(Float, default=0.0)
    cgst = Column(Float, default=0.0)
    sgst = Column(Float, default=0.0)
    sr_no = Column(String, nullable=True) # Serial number in 2B listing
    month = Column(String, nullable=True) # 2B period (e.g. 2025-10)
    
    application = relationship("RefundApplication", back_populates="gstr2b_records")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
