import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [client, setClient] = useState(null);
  const [alerts, setAlerts] = useState([]);
  
  // Ledger settings form state
  const [ledgerForm, setLedgerForm] = useState({
    cgst_end: 0,
    sgst_end: 0,
    cgst_filing: 0,
    sgst_filing: 0,
    buffer_adj: 305000
  });

  // Client Profile form state
  const [profileForm, setProfileForm] = useState({
    gstin: '',
    legal_name: '',
    address: '',
    arn: '',
    lut_number: '',
    lut_start_date: '',
    lut_end_date: '',
    director_name: ''
  });

  // Processing status state
  const [processingStatus, setProcessingStatus] = useState({
    seeding: 'idle', // idle, loading, success, error
    reconcile: 'idle',
    cleanPr: 'idle',
    match2b: 'idle',
    excel: 'idle',
    pdfs: 'idle'
  });

  const [pdfResults, setPdfResults] = useState([]);
  const [pdfWarnings, setPdfWarnings] = useState([]);
  const [logMessages, setLogMessages] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Load initial dataset
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const addLog = (msg) => {
    setLogMessages(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch Client
      const clientRes = await fetch(`${API_BASE}/api/client`);
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        setClient(clientData);
        setProfileForm({
          gstin: clientData.gstin || '',
          legal_name: clientData.legal_name || '',
          address: clientData.address || '',
          arn: clientData.arn || '',
          lut_number: clientData.lut_number || '',
          lut_start_date: clientData.lut_start_date || '',
          lut_end_date: clientData.lut_end_date || '',
          director_name: clientData.director_name || ''
        });
      }

      // Fetch Dashboard Summary
      const summaryRes = await fetch(`${API_BASE}/api/dashboard/summary`);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
        setLedgerForm({
          cgst_end: summaryData.application.cgst_ledger_balance_end || 0,
          sgst_end: summaryData.application.sgst_ledger_balance_end || 0,
          cgst_filing: summaryData.application.cgst_ledger_balance_filing || 0,
          sgst_filing: summaryData.application.sgst_ledger_balance_filing || 0,
          buffer_adj: summaryData.application.ledger_buffer_adjustment || 305000
        });
      }

      // Fetch Audit Alerts
      const alertsRes = await fetch(`${API_BASE}/api/dashboard/audit-alerts`);
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      addLog("Error communicating with backend. Make sure the FastAPI server is running.");
    }
  };

  // Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setClient(updated);
        addLog("Client profile updated successfully.");
        fetchDashboardData();
      } else {
        addLog("Failed to save client profile.");
      }
    } catch (err) {
      addLog("Error saving client profile.");
    }
  };

  // Ledger update Save
  const handleUpdateLedger = async (e) => {
    e.preventDefault();
    try {
      const url = new URL(`${API_BASE}/api/application/ledger`);
      url.searchParams.append('cgst_end', ledgerForm.cgst_end);
      url.searchParams.append('sgst_end', ledgerForm.sgst_end);
      url.searchParams.append('cgst_filing', ledgerForm.cgst_filing);
      url.searchParams.append('sgst_filing', ledgerForm.sgst_filing);
      url.searchParams.append('buffer_adj', ledgerForm.buffer_adj);

      const res = await fetch(url.toString(), { method: 'POST' });
      if (res.ok) {
        addLog("Ledger balances and buffer updated. Recalculating...");
        fetchDashboardData();
      } else {
        addLog("Failed to update ledger values.");
      }
    } catch (err) {
      addLog("Error updating ledger values.");
    }
  };

  // Processing Actions
  const runSeeder = async () => {
    setProcessingStatus(prev => ({ ...prev, seeding: 'loading' }));
    addLog("Starting database seeding from SSPL dataset...");
    try {
      const res = await fetch(`${API_BASE}/api/process/seed`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setProcessingStatus(prev => ({ ...prev, seeding: 'success' }));
        addLog(data.message);
        fetchDashboardData();
      } else {
        setProcessingStatus(prev => ({ ...prev, seeding: 'error' }));
        addLog(`Seeding failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, seeding: 'error' }));
      addLog("Network error during seeding.");
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (['xlsb', 'xlsx', 'xls'].includes(ext)) {
        setSelectedFile(file);
        addLog(`Selected file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        addLog("Error: Invalid file type. Only .xlsb, .xlsx, and .xls files are supported.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      addLog(`Selected file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  const runUploadAndSeed = async () => {
    if (!selectedFile) {
      addLog("Please select or drop a file first.");
      return;
    }
    setProcessingStatus(prev => ({ ...prev, seeding: 'loading' }));
    addLog(`Uploading and seeding from ${selectedFile.name}...`);
    
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${API_BASE}/api/process/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setProcessingStatus(prev => ({ ...prev, seeding: 'success' }));
        addLog(data.message);
        setSelectedFile(null); // Clear selected file on success
        fetchDashboardData();
      } else {
        setProcessingStatus(prev => ({ ...prev, seeding: 'error' }));
        addLog(`Upload/Seeding failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, seeding: 'error' }));
      addLog("Network error during file upload/seeding.");
    }
  };

  const runReconciliation = async () => {
    setProcessingStatus(prev => ({ ...prev, reconcile: 'loading' }));
    addLog("Running FIFO sales invoice and FIRC reconciliation...");
    try {
      const res = await fetch(`${API_BASE}/api/process/reconcile`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setProcessingStatus(prev => ({ ...prev, reconcile: 'success' }));
        addLog(data.message);
        fetchDashboardData();
      } else {
        setProcessingStatus(prev => ({ ...prev, reconcile: 'error' }));
        addLog(`Reconciliation failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, reconcile: 'error' }));
      addLog("Network error during reconciliation.");
    }
  };

  const runCleanPR = async () => {
    setProcessingStatus(prev => ({ ...prev, cleanPr: 'loading' }));
    addLog("Standardising Purchase Register and splitting IMPS/RCM...");
    try {
      const res = await fetch(`${API_BASE}/api/process/clean-pr`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setProcessingStatus(prev => ({ ...prev, cleanPr: 'success' }));
        addLog(data.message);
        fetchDashboardData();
      } else {
        setProcessingStatus(prev => ({ ...prev, cleanPr: 'error' }));
        addLog(`PR cleaning failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, cleanPr: 'error' }));
      addLog("Network error during PR cleaning.");
    }
  };

  const runMatch2b = async () => {
    setProcessingStatus(prev => ({ ...prev, match2b: 'loading' }));
    addLog("Matching Purchase Register against GSTR-2B Listing...");
    try {
      const res = await fetch(`${API_BASE}/api/process/match-2b`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setProcessingStatus(prev => ({ ...prev, match2b: 'success' }));
        addLog(data.message);
        fetchDashboardData();
      } else {
        setProcessingStatus(prev => ({ ...prev, match2b: 'error' }));
        addLog(`2B matching failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, match2b: 'error' }));
      addLog("Network error during 2B matching.");
    }
  };

  const runGenerateExcel = async () => {
    setProcessingStatus(prev => ({ ...prev, excel: 'loading' }));
    addLog("Generating Master Output Excel utility...");
    try {
      const res = await fetch(`${API_BASE}/api/process/generate-excel`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setProcessingStatus(prev => ({ ...prev, excel: 'success' }));
        addLog(data.message);
        fetchDashboardData();
      } else {
        setProcessingStatus(prev => ({ ...prev, excel: 'error' }));
        addLog(`Excel generation failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, excel: 'error' }));
      addLog("Network error during Excel generation.");
    }
  };

  const runGeneratePdfs = async () => {
    setProcessingStatus(prev => ({ ...prev, pdfs: 'loading' }));
    addLog("Generating 10 Cover Letters and Portal Declarations...");
    try {
      const res = await fetch(`${API_BASE}/api/process/generate-pdfs`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setProcessingStatus(prev => ({ ...prev, pdfs: 'success' }));
        addLog(data.message);
        setPdfResults(data.pdfs || []);
        setPdfWarnings(data.warnings || []);
        fetchDashboardData();
      } else {
        setProcessingStatus(prev => ({ ...prev, pdfs: 'error' }));
        addLog(`PDF generation failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setProcessingStatus(prev => ({ ...prev, pdfs: 'error' }));
      addLog("Network error during PDF generation.");
    }
  };

  // Quick Format Helper for Currency
  const formatINR = (val) => {
    if (val === undefined || val === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <>
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">GST</div>
          <div>
            <div className="logo-text">Refund Automator</div>
            <div className="logo-subtitle">Rule 89(4) Portal Utility</div>
          </div>
        </div>

        <ul className="nav-links">
          <li 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="nav-item-icon">📊</span>
            Dashboard
          </li>
          <li 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="nav-item-icon">🏢</span>
            Client Profile
          </li>
          <li 
            className={`nav-item ${activeTab === 'processing' ? 'active' : ''}`}
            onClick={() => setActiveTab('processing')}
          >
            <span className="nav-item-icon">⚙️</span>
            Seeder & Processing
          </li>
          <li 
            className={`nav-item ${activeTab === 'pdfs' ? 'active' : ''}`}
            onClick={() => setActiveTab('pdfs')}
          >
            <span className="nav-item-icon">📄</span>
            PDFs & Letters
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="sidebar-footer-title">Active Workspace</div>
          <div>Oct 25 — Dec 25</div>
          <div style={{ marginTop: '5px', fontSize: '0.7rem', opacity: 0.7 }}>v1.0.0 Stable</div>
        </div>
      </div>

      {/* Main Container */}
      <div className="main-content">
        
        {/* Header */}
        <header className="app-header">
          <div className="header-title">
            <h1>GST Refund Processing Portal</h1>
            <p>Export of Services Without Payment of Tax under Rule 89(4)</p>
          </div>
          {client && (
            <div className="client-pill">
              <span className="client-indicator"></span>
              <strong>{client.legal_name || 'Pending load...'}</strong>
            </div>
          )}
        </header>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            {/* KPI Section */}
            {summary && (
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">Zero Rated Turnover (ZRT)</div>
                  <div className="kpi-value">{formatINR(summary.application.zero_rated_turnover)}</div>
                  <div className="kpi-subtitle">Reconciled Exports</div>
                </div>
                <div className="kpi-card cyan">
                  <div className="kpi-label">Net ITC for Refund</div>
                  <div className="kpi-value">{formatINR(summary.application.net_itc)}</div>
                  <div className="kpi-subtitle">Eligible input service credits</div>
                </div>
                <div className="kpi-card amber">
                  <div className="kpi-label">Max Claim Allowed</div>
                  <div className="kpi-value">{formatINR(summary.application.max_refund_allowed)}</div>
                  <div className="kpi-subtitle">Apportioned formula limit</div>
                </div>
                <div className="kpi-card emerald">
                  <div className="kpi-label">Claimed CGST/SGST</div>
                  <div className="kpi-value" style={{ fontSize: '1.4rem' }}>
                    {formatINR(summary.application.refund_claimed_cgst)} each
                  </div>
                  <div className="kpi-subtitle">Ledger-restricted actual claims</div>
                </div>
              </div>
            )}

            {/* Main dashboard columns */}
            <div className="form-row">
              {/* Column 1: Progress Tracker & Audit Alerts */}
              <div style={{ flex: 1.5 }}>
                
                {/* Stepper Status */}
                <div className="glass-card">
                  <div className="glass-card-title">Preparation Checklist & Progress</div>
                  <div className="stepper">
                    <div className="stepper-progress" style={{ 
                      width: summary ? 
                        (processingStatus.pdfs === 'success' ? '100%' :
                         processingStatus.excel === 'success' ? '80%' :
                         processingStatus.match2b === 'success' ? '60%' :
                         processingStatus.reconcile === 'success' ? '40%' : '20%') : '0%'
                    }}></div>
                    <div className={`step ${summary ? 'completed' : ''}`}>
                      <div className="step-circle">1</div>
                      <div className="step-label">Data Seeded</div>
                    </div>
                    <div className={`step ${summary && summary.application.zero_rated_turnover > 0 ? 'completed' : ''}`}>
                      <div className="step-circle">2</div>
                      <div className="step-label">Reconciled</div>
                    </div>
                    <div className={`step ${summary && summary.purchase_count > 0 ? 'completed' : ''}`}>
                      <div className="step-circle">3</div>
                      <div className="step-label">PR Cleaned</div>
                    </div>
                    <div className={`step ${summary && summary.application.net_itc > 0 ? 'completed' : ''}`}>
                      <div className="step-circle">4</div>
                      <div className="step-label">Excel Output</div>
                    </div>
                    <div className={`step ${pdfResults.length > 0 ? 'completed' : ''}`}>
                      <div className="step-circle">5</div>
                      <div className="step-label">PDF Declarations</div>
                    </div>
                  </div>
                </div>

                {/* Audit Alerts */}
                <div className="glass-card">
                  <div className="glass-card-title">
                    <span>Audit Warnings & Validation Alerts</span>
                    <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-error)' }}>
                      {alerts.length} Flagged
                    </span>
                  </div>
                  
                  {alerts.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                      All clear! No LUT mismatch, overlap issues or FIRC gaps identified.
                    </div>
                  ) : (
                    <div>
                      {alerts.map((al, idx) => (
                        <div key={idx} className={`alert ${al.type === 'error' ? 'alert-error' : 'alert-warning'}`}>
                          <span className="alert-icon">{al.type === 'error' ? '🚫' : '⚠️'}</span>
                          <div>{al.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Column 2: Electronic Credit Ledger Settings */}
              <div style={{ flex: 1 }}>
                
                {/* Ledger balances card */}
                {summary && (
                  <div className="glass-card">
                    <div className="glass-card-title">Electronic Credit Ledger Balances</div>
                    <form onSubmit={handleUpdateLedger}>
                      <div className="form-group">
                        <label className="form-label">Balance at end of Period (Dec 25)</label>
                        <div className="form-row">
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CGST</span>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={ledgerForm.cgst_end}
                              onChange={e => setLedgerForm({ ...ledgerForm, cgst_end: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SGST</span>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={ledgerForm.sgst_end}
                              onChange={e => setLedgerForm({ ...ledgerForm, sgst_end: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Balance at time of Filing</label>
                        <div className="form-row">
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CGST</span>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={ledgerForm.cgst_filing}
                              onChange={e => setLedgerForm({ ...ledgerForm, cgst_filing: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SGST</span>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={ledgerForm.sgst_filing}
                              onChange={e => setLedgerForm({ ...ledgerForm, sgst_filing: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Manual Ledger Claim Buffer (Adjustment)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={ledgerForm.buffer_adj}
                          onChange={e => setLedgerForm({ ...ledgerForm, buffer_adj: parseFloat(e.target.value) || 0 })}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)' }}>
                          This buffer is subtracted from the final claimed amount to retain credit ledger cushion.
                        </span>
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        💾 Apply & Recalculate
                      </button>
                    </form>
                  </div>
                )}

                {/* Database counts Summary */}
                {summary && (
                  <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div className="glass-card-title" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Loaded Records Summary</div>
                    <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                      <tbody>
                        <tr>
                          <td>Sales Register (Exports / Domestic)</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{summary.invoice_count} rows</td>
                        </tr>
                        <tr>
                          <td>FIRC Remittance Listing</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{summary.firc_count} rows</td>
                        </tr>
                        <tr>
                          <td>Purchase Register Records</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{summary.purchase_count} rows</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Client Profile Tab */}
        {activeTab === 'profile' && (
          <div className="glass-card animate-fade-in">
            <div className="glass-card-title">Client Profile Settings</div>
            
            <form onSubmit={handleSaveProfile}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">GSTIN (Supplier)*</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={profileForm.gstin} 
                    onChange={e => setProfileForm({ ...profileForm, gstin: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Legal Name of Business*</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={profileForm.legal_name} 
                    onChange={e => setProfileForm({ ...profileForm, legal_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Registered Address*</label>
                <textarea 
                  className="form-control" 
                  rows="3"
                  value={profileForm.address} 
                  onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ARN (Application Reference Number)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={profileForm.arn} 
                    onChange={e => setProfileForm({ ...profileForm, arn: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Authorized Director / Signatory Name*</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={profileForm.director_name} 
                    onChange={e => setProfileForm({ ...profileForm, director_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="glass-card" style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-card-title" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>LUT (Letter of Undertaking) Verification Details</div>
                <div className="form-group">
                  <label className="form-label">LUT Reference Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={profileForm.lut_number} 
                    onChange={e => setProfileForm({ ...profileForm, lut_number: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">LUT Start Date Validity</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={profileForm.lut_start_date} 
                      onChange={e => setProfileForm({ ...profileForm, lut_start_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">LUT End Date Validity</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={profileForm.lut_end_date} 
                      onChange={e => setProfileForm({ ...profileForm, lut_end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary">
                💾 Save Profile Credentials
              </button>
            </form>
          </div>
        )}

        {/* Seeder & Processing Tab */}
        {activeTab === 'processing' && (
          <div className="animate-fade-in">
            {/* Upload Card */}
            <div className="glass-card">
              <div className="glass-card-title">Upload Client Dataset Workbook</div>
              
              <div 
                className="upload-dropzone"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload-input').click()}
                style={{
                  borderStyle: dragActive ? 'solid' : 'dashed',
                  borderColor: dragActive ? 'var(--accent-primary)' : 'var(--border-glass)',
                  padding: '2.5rem 1.5rem',
                  marginBottom: '1.5rem',
                  background: dragActive ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.01)'
                }}
              >
                <input 
                  id="file-upload-input"
                  type="file" 
                  style={{ display: 'none' }} 
                  accept=".xlsb,.xlsx,.xls"
                  onChange={handleFileChange}
                />
                <div className="upload-icon">📥</div>
                <div style={{ fontWeight: '600', fontSize: '1.05rem', color: 'white' }}>
                  {selectedFile ? `Selected: ${selectedFile.name}` : "Drag & drop client Excel workbook here"}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "Supports .xlsb, .xlsx, .xls formats"}
                </div>
              </div>

              {selectedFile && (
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    disabled={processingStatus.seeding === 'loading'}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={(e) => {
                      e.stopPropagation();
                      runUploadAndSeed();
                    }}
                    disabled={processingStatus.seeding === 'loading'}
                  >
                    {processingStatus.seeding === 'loading' ? '⚡ Uploading & Seeding...' : '🚀 Upload & Seed Database'}
                  </button>
                </div>
              )}
            </div>

            <div className="glass-card">
              <div className="glass-card-title">Refund Processing Pipeline Workflow</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                
                {/* Workflow Card 1 */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem', color: 'white', display: 'block', marginBottom: '0.5rem' }}>1. Database Seeder</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Seeds the SQLite database directly from the provided client Excel workbook (`SSPL refund Oct 25 to Dec 25 final V1.xlsb`).
                    </p>
                  </div>
                  <button 
                    onClick={runSeeder}
                    disabled={processingStatus.seeding === 'loading'}
                    className={`btn ${processingStatus.seeding === 'success' ? 'btn-success' : 'btn-primary'}`}
                    style={{ width: '100%' }}
                  >
                    {processingStatus.seeding === 'loading' ? '⚡ Seeding DB...' : 
                     processingStatus.seeding === 'success' ? '✓ Seed Completed' : '🚀 Seed Database'}
                  </button>
                </div>

                {/* Workflow Card 2 */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem', color: 'white', display: 'block', marginBottom: '0.5rem' }}>2. Sales & FIRC FIFO Match</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Runs the chronological FIFO matching engine to reconcile export invoices with FIRC bank remittances.
                    </p>
                  </div>
                  <button 
                    onClick={runReconciliation}
                    disabled={processingStatus.reconcile === 'loading'}
                    className={`btn ${processingStatus.reconcile === 'success' ? 'btn-success' : 'btn-primary'}`}
                    style={{ width: '100%' }}
                  >
                    {processingStatus.reconcile === 'loading' ? '⚡ Matching...' : 
                     processingStatus.reconcile === 'success' ? '✓ Reconciliation Completed' : '⚡ Run FIRC Matching'}
                  </button>
                </div>

                {/* Workflow Card 3 */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem', color: 'white', display: 'block', marginBottom: '0.5rem' }}>3. PR Cleaning & 2B Match</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Cleans the raw purchase ledger, extracts IMPS/RCM transactions, and matches eligible credits with GSTR-2B.
                    </p>
                  </div>
                  <button 
                    onClick={async () => {
                      await runCleanPR();
                      await runMatch2b();
                    }}
                    disabled={processingStatus.cleanPr === 'loading' || processingStatus.match2b === 'loading'}
                    className={`btn ${processingStatus.match2b === 'success' ? 'btn-success' : 'btn-primary'}`}
                    style={{ width: '100%' }}
                  >
                    {processingStatus.match2b === 'loading' ? '⚡ Matching 2B...' : 
                     processingStatus.match2b === 'success' ? '✓ PR/2B Processing Done' : '⚡ Process Purchases'}
                  </button>
                </div>

                {/* Workflow Card 4 */}
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem', color: 'white', display: 'block', marginBottom: '0.5rem' }}>4. Master Output Excel</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Compiles the portal-ready spreadsheets (Statement 3, Annexure B) and review audit tabs into a single workbook.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                      onClick={runGenerateExcel}
                      disabled={processingStatus.excel === 'loading'}
                      className={`btn ${processingStatus.excel === 'success' ? 'btn-success' : 'btn-primary'}`}
                      style={{ width: '100%' }}
                    >
                      {processingStatus.excel === 'loading' ? '⚡ Compiling Excel...' : 
                       processingStatus.excel === 'success' ? '✓ Master Excel Ready' : '⚙️ Compile Master Excel'}
                    </button>
                    {processingStatus.excel === 'success' && (
                      <a 
                        href={`${API_BASE}/api/process/download-excel`}
                        target="_blank" 
                        rel="noreferrer"
                        className="btn btn-outline" 
                        style={{ width: '100%', textDecoration: 'none' }}
                      >
                        📥 Download Excel
                      </a>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Execution logs output terminal */}
            <div className="glass-card" style={{ background: '#090d16', borderColor: '#1f293d', fontFamily: 'monospace' }}>
              <div className="glass-card-title" style={{ fontSize: '0.95rem', borderBottom: '1px solid #1f293d', paddingBottom: '0.5rem', color: 'var(--accent-secondary)' }}>
                System Process Terminal Logs
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.85rem', color: '#8892b0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {logMessages.length === 0 ? (
                  <div style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>Terminal idle. Run actions above.</div>
                ) : (
                  logMessages.map((log, idx) => <div key={idx}>{log}</div>)
                )}
              </div>
            </div>
          </div>
        )}

        {/* PDFs & Letters Tab */}
        {activeTab === 'pdfs' && (
          <div className="glass-card animate-fade-in">
            <div className="glass-card-title">
              <span>Cover Letter & Portal Declarations Builder</span>
              <button 
                onClick={runGeneratePdfs} 
                className={`btn ${processingStatus.pdfs === 'success' ? 'btn-success' : 'btn-primary'}`}
                disabled={processingStatus.pdfs === 'loading'}
              >
                {processingStatus.pdfs === 'loading' ? '⚡ Compiling PDFs...' : '📄 Generate & Pre-Check PDFs'}
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Generates the 10 portal-required declarations and cover letters in ReportLab PDF format. The system automatically performs a file size validation check to ensure each PDF is within the GST portal upload limit of 5.0 MB.
            </p>

            {/* Warnings list */}
            {pdfWarnings.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                {pdfWarnings.map((w, idx) => (
                  <div key={idx} className="alert alert-error">
                    <span className="alert-icon">⚠️</span>
                    <div>{w}</div>
                  </div>
                ))}
              </div>
            )}

            {/* PDFs rendering list */}
            {pdfResults.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '3rem' }}>
                PDF list empty. Click the button above to generate letters.
              </div>
            ) : (
              <div className="pdf-list">
                {pdfResults.map((p, idx) => (
                  <div key={idx} className="pdf-item">
                    <div className="pdf-info">
                      <span className="pdf-name">📄 {p.name}</span>
                      <span className="pdf-meta">Compiled via ReportLab · Size: {(p.size_kb).toFixed(2)} KB</span>
                    </div>
                    <div>
                      <span className={`pdf-size-badge ${p.size_kb <= 5000 ? 'safe' : 'warn'}`}>
                        {p.size_kb <= 5000 ? '✓ Within 5MB Limit' : '⚠ Exceeds 5MB'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}

export default App;
