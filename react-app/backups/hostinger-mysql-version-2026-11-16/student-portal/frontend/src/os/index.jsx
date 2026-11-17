/* Academy OS: page for a route { page: 'os', key } */
import { Component } from 'react';
import { Shell } from '../components/Layout.jsx';
import * as P from './Pages.jsx';
import Settings from './Settings.jsx';
import SystemMap from './SystemMap.jsx';
import Icon from '../components/Icon.jsx';
import { homeRoute, readRole } from './permissions.js';

const PAGES = {
  overview: P.Overview, 'system-map': SystemMap, enquiries: P.Enquiries, 'new-admission': P.NewAdmission,
  'all-students': P.AllStudents, documents: P.Documents, exams: P.Exams,
  'fee-dashboard': P.FeeDashboard, 'fee-accounts': P.FeeAccounts, 'fee-plans': P.FeePlans, payments: P.Payments,
  'pending-fees': P.PendingFees, discounts: P.Discounts, expenses: P.Expenses, 'cash-bank': P.CashBank,
  'finance-reports': P.FinanceReports, approvals: P.Approvals, employees: P.Employees, notifications: P.Notifications,
  settings: Settings, 'audit-logs': P.AuditLogs,
};
export const OS_KEYS = Object.keys(PAGES);

export default function OSPage({ k }) {
  const Page = PAGES[k] || P.Overview;
  return <Shell><div className="os">{<Page />}</div></Shell>;
}

export function Restricted({ name, role }) {
  return (
    <Shell>
      <div className="os"><div className="os-card os-cardbody text-center py-5">
        <div className="state-ico"><Icon name="info" size={30} /></div>
        <h5 className="mt-2">{name} is not available for the {role} login</h5>
        <div className="os-sub">Ask the owner if you need this page.</div>
      </div></div>
    </Shell>
  );
}

/** If a page fails, show the problem and a way back instead of a blank screen (rest of the portal keeps working) */
export class PageGuard extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Page error:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Shell>
        <div className="os"><div className="os-card os-cardbody text-center py-5">
          <div className="state-ico danger"><Icon name="alert" size={30} /></div>
          <h5 className="mt-2">This page could not be shown</h5>
          <div className="os-sub mb-3">{String(this.state.error?.message || this.state.error)}</div>
          <div className="d-flex gap-2 justify-content-center">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => this.setState({ error: null })}>Try again</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => this.props.go(homeRoute(readRole()))}>Go to start page</button>
          </div>
        </div></div>
      </Shell>
    );
  }
}

/** Last safety net (used around the whole app): plain message if even the frame cannot be drawn */
export class RootGuard extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 40, fontFamily: 'Segoe UI, sans-serif' }}>
        <h3>Something went wrong</h3>
        <p style={{ color: '#64748b' }}>{String(this.state.error?.message || this.state.error)}</p>
        <button type="button" className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.hash = 'os-' + homeRoute(readRole()).key; }}>Back to start page</button>
      </div>
    );
  }
}
