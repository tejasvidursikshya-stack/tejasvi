import React, { useEffect, useState } from 'react';
import { Printer, AlertCircle, RefreshCw } from 'lucide-react';
import { Letterhead, LetterFooter } from './Letterhead.jsx';
const amount = value => new Intl.NumberFormat('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
const date = value => value ? new Date(value.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function FeeDocumentContent({ data, ctx }) {
    const { institution, student, invoice, receipt, payments, paid, balance } = data;
    return <article className="fee-document">
        {(invoice.sample || receipt?.sample) && <div className="document-sample">SAMPLE DOCUMENT · FICTIONAL DATA</div>}
        {ctx && <Letterhead ctx={ctx} title={receipt ? 'PAYMENT RECEIPT' : 'FEE INVOICE'} />}
        <header className={'document-heading' + (ctx ? ' document-heading-slim' : '')}><div>{!ctx && <><span className="eyebrow">{receipt ? 'PAYMENT RECEIPT' : 'FEE INVOICE'}</span><h1>{institution.name}</h1><p>{institution.address}</p><p>{[institution.phone, institution.email].filter(Boolean).join(' · ')}</p>{institution.code && <small>Institution code: {institution.code}</small>}</>}</div><div><strong>{receipt?.receiptNo || invoice.invoiceNo}</strong><p>Academic year {invoice.year}</p><p>{receipt ? `Payment date: ${date(receipt.date)}` : `Issued: ${date(invoice.createdAt)}`}</p></div></header>
        <div className="document-student"><div><small>{receipt ? 'RECEIVED FROM' : 'BILLED TO'}</small><h2>{student.name}</h2><p>Student ID: {student.studentNo}</p></div><div><p>{student.program}</p><p>Semester / year: {student.semester}</p><p>Invoice: {invoice.invoiceNo}</p></div></div>
        <table className="document-line-items"><thead><tr><th>Description</th><th className="text-right">Amount (NPR)</th></tr></thead><tbody><tr><td><b>{invoice.category} fee{receipt ? ' payment' : ''}</b><small>{receipt ? `Payment method: ${receipt.method}` : `Due date: ${date(invoice.dueDate)}`}</small>{receipt?.reference && <small>Transaction reference: {receipt.reference}</small>}</td><td className="text-right"><strong>{amount(receipt ? receipt.amount : invoice.amount)}</strong></td></tr></tbody></table>
        <div className="document-totals"><div><span>Invoice amount</span><b>NPR {amount(invoice.amount)}</b></div><div><span>Total received to date</span><b>NPR {amount(paid)}</b></div><div className="document-balance"><span>Current balance</span><strong>NPR {amount(balance)}</strong></div></div>
        {!receipt && payments.length > 0 && <section className="document-payments"><h3>Recorded payments</h3><table><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th className="text-right">NPR</th></tr></thead><tbody>{payments.map((p, i) => <tr key={i}><td>{p.receiptNo}</td><td>{date(p.date)}</td><td>{p.method}</td><td className="text-right">{amount(p.amount)}</td></tr>)}</tbody></table></section>}
        {(receipt?.notes || (!receipt && invoice.notes)) && <section className="document-notes"><h3>Notes</h3><p>{receipt ? receipt.notes : invoice.notes}</p></section>}
        <footer className="document-footer"><p>{receipt ? 'This receipt acknowledges the recorded payment only.' : 'Please quote the invoice number when making a payment.'} Balances reflect saved records at the time this document was generated.</p><div><span>Prepared through EMIS · {new Date(data.generatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })} (Nepal time)</span>{!ctx && <span>Authorized signature: __________________</span>}</div></footer>
        {ctx && <LetterFooter ctx={ctx} signs={['accountant']} seal />}
    </article>;
}

export default function FeeDocument({ ctx, entity, id, api, Modal, onClose }) {
    const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
    const type = entity === 'payments' ? 'receipt' : 'invoice';
    useEffect(() => {
        let live = true; setData(null); setError('');
        api(`/finance/documents/${type}/${id}`).then(value => { if (live) setData(value); }).catch(e => { if (live) setError(e.message); });
        return () => { live = false; };
    }, [type, id, revision]);
    useEffect(() => { document.body.classList.add('printing-fee-document'); return () => document.body.classList.remove('printing-fee-document'); }, []);
    return <div className="fee-print-layer"><Modal title={type === 'receipt' ? 'Payment receipt' : 'Fee invoice'} subtitle="Print this document or save it as PDF from your browser." wide onClose={onClose}><div className="modal-body">
        {error ? <><div className="error-box" role="alert"><AlertCircle size={17}/>{error}</div><button className="btn" onClick={() => setRevision(v => v + 1)}><RefreshCw size={16}/>Retry</button></> : data ? <FeeDocumentContent data={data} ctx={ctx}/> : <p role="status">Preparing your document…</p>}
    </div><footer><button className="btn" onClick={onClose}>Close</button><button className="btn primary" disabled={!data} onClick={() => window.print()}><Printer size={16}/>Print / Save PDF</button></footer></Modal></div>;
}
