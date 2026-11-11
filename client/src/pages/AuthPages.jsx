import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { go } from '../router.jsx';
import { Icon } from '../ui.jsx';

function Shell({ title, subtitle, children }) {
  return (
    <div className="container">
      <div className="auth">
        <div className="art">
          <span className="shape a1" /><span className="shape a2" />
          <h2>ShopNest</h2>
          <p style={{ opacity: 0.92 }}>Millions of happy deliveries start with one click. Shop, track and save.</p>
          <p style={{ fontSize: 64, margin: 0 }} aria-hidden="true">🛍️</p>
        </div>
        <div className="form">
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

const Field = ({ icon, ...props }) => (
  <div className="field iconfield"><Icon name={icon} size={18} /><input {...props} /></div>
);

export function LoginPage({ next }) {
  const { login, toast } = useApp();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: f });
      login(data);
      toast(`Welcome back, ${data.user.name}!`, 'success');
      go(next || '/');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Welcome back" subtitle="Log in to continue shopping.">
      <form onSubmit={submit}>
        <Field icon="mail" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <Field icon="lock" type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <p style={{ textAlign: 'right' }}><a href="#/forgot">Forgot password?</a></p>
        <button className="btn block" disabled={busy}>{busy && <span className="spinner" />} Log in</button>
      </form>
      <p className="center muted" style={{ marginTop: 16 }}>New here? <a href="#/register">Create an account</a></p>
    </Shell>
  );
}

export function RegisterPage() {
  const { toast } = useApp();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.confirm) return toast('The two passwords do not match', 'error');
    setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', body: { name: f.name, email: f.email, password: f.password } });
      toast('Account created. Please log in.', 'success');
      go('/login');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Create your account" subtitle="It takes less than a minute.">
      <form onSubmit={submit}>
        <Field icon="user" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <Field icon="mail" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <Field icon="lock" type="password" placeholder="Password (8 or more characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <Field icon="lock" type="password" placeholder="Confirm password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
        <button className="btn block" disabled={busy}>{busy && <span className="spinner" />} Sign up</button>
      </form>
      <p className="center muted" style={{ marginTop: 16 }}>Already have an account? <a href="#/login">Log in</a></p>
    </Shell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useApp();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMsg(r.message);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Forgot your password?" subtitle="Enter your email and we will send you a link to choose a new one.">
      {msg ? (
        <div className="deliv"><Icon name="mail" /> {msg}</div>
      ) : (
        <form onSubmit={submit}>
          <Field icon="mail" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn block" disabled={busy}>{busy && <span className="spinner" />} Send reset link</button>
        </form>
      )}
      <p className="center muted" style={{ marginTop: 16 }}><a href="#/login">Back to log in</a></p>
    </Shell>
  );
}

export function ResetPage({ token }) {
  const { toast } = useApp();
  const [f, setF] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.confirm) return toast('The two passwords do not match', 'error');
    setBusy(true);
    try {
      const r = await api('/auth/reset-password', { method: 'POST', body: { token, password: f.password } });
      toast(r.message, 'success');
      go('/login');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Choose a new password" subtitle="Use at least 8 characters.">
      {!token ? (
        <p className="err">This link is not valid. <a href="#/forgot">Request a new one</a>.</p>
      ) : (
        <form onSubmit={submit}>
          <Field icon="lock" type="password" placeholder="New password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          <Field icon="lock" type="password" placeholder="Confirm new password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
          <button className="btn block" disabled={busy}>{busy && <span className="spinner" />} Change password</button>
        </form>
      )}
    </Shell>
  );
}
