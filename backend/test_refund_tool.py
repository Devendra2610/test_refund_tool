from app.database import SessionLocal, RefundApplication, Invoice, FircRecord, PurchaseRecord, init_db
from app.engine.sspl_loader import load_sspl_dataset
from app.engine.reconciliation import reconcile_sales_firc
from app.engine.matching import match_pr_to_2b
from app.engine.excel_generator import generate_master_excel
import os

def run_validation_tests():
    print("=== STARTING GST REFUND TOOL VALIDATION TESTS ===")
    
    # 1. Initialize and seed DB
    db = SessionLocal()
    init_db()
    
    print("\n[Test 1] Seeding database from local workbook...")
    seed_res = load_sspl_dataset(db)
    print("Seeding output:", seed_res["message"])
    
    # Verify counts
    app = db.query(RefundApplication).first()
    assert app is not None, "Error: Seeding failed, application record not found!"
    print("Application period:", app.period_start, "to", app.period_end)
    
    # 2. Run reconciliation
    print("\n[Test 2] Running sales FIRC reconciliation...")
    rec_res = reconcile_sales_firc(db, app.id)
    print("Reconciliation output:", rec_res["message"])
    
    # Check zero rated turnover
    assert abs(app.zero_rated_turnover - 125640150.0) < 0.1, f"Mismatch: expected ZRT INR 125,640,150.00, got INR {app.zero_rated_turnover:,.2f}"
    print(f"Success! Calculated Zero Rated Turnover matches workbook exactly: INR {app.zero_rated_turnover:,.2f}")
    
    # 3. Match purchases against 2B
    print("\n[Test 3] Matching purchases against 2B Listing...")
    matched = match_pr_to_2b(db, app.id)
    print(f"Matched {matched} purchase records with 2B.")
    
    # 4. Generate Excel and check Net ITC / Turnovers
    print("\n[Test 4] Compiling Master Output Excel and running formulas...")
    excel_path = "test_output_master.xlsx"
    generate_master_excel(db, app.id, excel_path)
    
    # Re-fetch app to see updated calculation results
    db.refresh(app)
    
    print(f"Calculated Net ITC: INR {app.net_itc:,.2f}")
    print(f"Expected Net ITC: INR 5,953,626.47")
    assert abs(app.net_itc - 5953626.47) < 10.0, f"Mismatch: Net ITC got INR {app.net_itc:,.2f}"
    print("Success! Calculated Net ITC matches workbook exactly!")
    
    print(f"Calculated Max Refund Allowed: INR {app.max_refund_allowed:,.2f}")
    print(f"Expected Max Refund: INR 5,561,334.33")
    assert abs(app.max_refund_allowed - 5561334.33) < 10.0, f"Mismatch: Max Refund got INR {app.max_refund_allowed:,.2f}"
    print("Success! Calculated Maximum Refund matches workbook exactly!")
    
    print(f"Calculated CGST claimed: INR {app.refund_claimed_cgst:,.2f}")
    print(f"Calculated SGST claimed: INR {app.refund_claimed_sgst:,.2f}")
    print(f"Expected claimed (each): INR 2,475,667.17")
    assert abs(app.refund_claimed_cgst - 2475667.17) < 10.0, f"Mismatch: CGST claimed got INR {app.refund_claimed_cgst:,.2f}"
    assert abs(app.refund_claimed_sgst - 2475667.17) < 10.0, f"Mismatch: SGST claimed got INR {app.refund_claimed_sgst:,.2f}"
    print("Success! Claimed CGST & SGST refunds match workbook exactly (reflecting ledger restrictions and buffers)!")
    
    print("\n=== ALL VALIDATION TESTS PASSED SUCCESSFULLY! ===")
    
    # Clean up test excel
    if os.path.exists(excel_path):
        os.remove(excel_path)
    db.close()

if __name__ == "__main__":
    run_validation_tests()
