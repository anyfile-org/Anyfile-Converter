import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Shield,
  Zap,
  FileText,
  Image as ImageIcon,
  Video,
  Archive,
  ExternalLink,
  Globe,
  Sliders,
  Layers,
  ChevronRight,
  Lock,
  X,
  Menu
} from 'lucide-react';
import { convertImageClientSide, triggerBlobDownload } from '../utils/webConverter';
import { trackAnalyticsEvent, TrackedOperation } from '../services/analytics';

const GithubIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const OFFICIAL_REPO = "https://github.com/anyfile-org/Anyfile-Converter";
const LATEST_RELEASE = "https://github.com/anyfile-org/Anyfile-Converter/releases/latest";

interface ReleaseData {
  version: string;
  releaseUrl: string;
  downloadUrl: string;
  installerName: string;
}

const DEFAULT_RELEASE: ReleaseData = {
  version: 'Latest',
  releaseUrl: LATEST_RELEASE,
  downloadUrl: LATEST_RELEASE,
  installerName: 'Choose an installer from GitHub Releases',
};

const BUTTON_OPERATIONS: Record<
  'download_latest' | 'github_repo' | 'view_releases' | 'web_app_open' | 'try_demo',
  TrackedOperation
> = {
  download_latest: 'button.download_latest',
  github_repo: 'button.github_repo',
  view_releases: 'button.view_releases',
  web_app_open: 'button.web_app_open',
  try_demo: 'button.try_demo',
};

export default function Landing() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean | null>(null);

  // Live in-browser converter demo state
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const [demoFormat, setDemoFormat] = useState<'png' | 'jpg' | 'webp' | 'avif'>('png');
  const [demoQuality, setDemoQuality] = useState<number>(80);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [convertedResult, setConvertedResult] = useState<{ blob: Blob; fileName: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [releaseData, setReleaseData] = useState<ReleaseData>(DEFAULT_RELEASE);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('anyfile_analytics_consent');
      setAnalyticsConsent(consent === 'yes' ? true : consent === 'no' ? false : null);
    } catch {
      setAnalyticsConsent(false);
    }

    // Auto-update release links and version dynamically from GitHub Releases API
    fetch('https://api.github.com/repos/anyfile-org/Anyfile-Converter/releases/latest')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.tag_name) {
          const tag = data.tag_name;
          const cleanVersion = tag.replace(/^v/, '');
          const exeAsset = data.assets?.find((a: any) => a.name && a.name.endsWith('.exe'));
          setReleaseData({
            version: tag,
            releaseUrl: data.html_url || LATEST_RELEASE,
            downloadUrl:
              exeAsset?.browser_download_url ||
              `https://github.com/anyfile-org/Anyfile-Converter/releases/download/${tag}/AnyFile.Convert_${cleanVersion}_x64-setup.exe`,
            installerName: exeAsset?.name || `AnyFile.Convert_${cleanVersion}_x64-setup.exe`,
          });
        }
      })
      .catch((error: unknown) => {
        console.warn('Could not load latest release metadata:', error);
      });
  }, []);

  const trackButtonClick = (buttonKey: keyof typeof BUTTON_OPERATIONS) => {
    trackAnalyticsEvent('button_clicked', BUTTON_OPERATIONS[buttonKey]);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Login failed');
      window.location.assign('/admin');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Invalid username or password');
    }
  };

  const handleDemoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDemoFile(e.target.files[0]);
      setConversionSuccess(false);
      setConvertedResult(null);
    }
  };

  const handleRunDemoConversion = async () => {
    if (!demoFile) return;
    setIsConverting(true);
    setConversionSuccess(false);
    setDemoError(null);
    try {
      const res = await convertImageClientSide(demoFile, demoFormat, demoQuality / 100);
      setConvertedResult({ blob: res.blob, fileName: res.fileName });
      setConversionSuccess(true);
      const operation: TrackedOperation = demoFormat === 'webp'
        ? 'image.to_webp'
        : demoFormat === 'avif'
        ? 'image.to_avif'
        : demoFile.name.toLowerCase().endsWith('.png') && demoFormat === 'jpg'
        ? 'image.png_to_jpg'
        : demoFile.name.toLowerCase().match(/\.jpe?g$/) && demoFormat === 'png'
        ? 'image.jpg_to_png'
        : 'image.demo_convert';
      trackAnalyticsEvent('operation_completed', operation);
    } catch (err) {
      console.error('Demo conversion failed:', err);
      setDemoError(err instanceof Error ? err.message : 'Conversion failed. Please try a different image.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="landing-page" style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-main)' }}>
      {/* Navigation Bar */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(23, 21, 18, 0.98)',
          borderBottom: '1px solid var(--border-light)',
          padding: '0.75rem 1.5rem',
        }}
      >
        <div
          className={`landing-nav-inner${isMobileMenuOpen ? ' menu-open' : ''}`}
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo & Brand */}
          <div className="landing-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '7px',
                background: 'var(--primary-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={20} color="#fff" />
            </div>
            <span
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                color: 'var(--text-main)',
              }}
            >
              AnyFile Convert
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-light)',
                padding: '2px 8px',
                borderRadius: '5px',
                fontWeight: 600,
              }}
            >
              {releaseData.version} Stable
            </span>
          </div>

          {/* Navigation Links */}
          <div id="landing-nav-links" className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '1.35rem' }}>
            <a
              href={LATEST_RELEASE}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                trackButtonClick('view_releases');
                setIsMobileMenuOpen(false);
              }}
              style={{ color: 'var(--text-muted)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              Latest Release <ExternalLink size={13} />
            </a>
            <a
              href={OFFICIAL_REPO}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                trackButtonClick('github_repo');
                setIsMobileMenuOpen(false);
              }}
              style={{ color: 'var(--text-muted)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <GithubIcon size={15} /> Official GitHub
            </a>
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}
            >
              Features
            </a>
            <a
              href="#demo"
              onClick={() => {
                trackButtonClick('try_demo');
                setIsMobileMenuOpen(false);
              }}
              style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}
            >
              Try Online
            </a>
          </div>

          {/* Action & Login Button on Top */}
          <button
            className="landing-nav-toggle"
            type="button"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="landing-nav-links landing-nav-actions"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div id="landing-nav-actions" className="landing-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <a
              href={releaseData.downloadUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                trackButtonClick('download_latest');
                setIsMobileMenuOpen(false);
              }}
              className="btn btn-primary"
              style={{ fontSize: '0.88rem', padding: '0.5rem 1.15rem' }}
            >
              <Download size={15} />
              Download {releaseData.version}
            </a>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setShowLoginModal(true);
              }}
              className="btn btn-secondary"
              style={{
                fontSize: '0.88rem',
                padding: '0.5rem 1rem',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Lock size={14} style={{ color: 'var(--primary-accent)' }} />
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Login Modal */}
      {showLoginModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '420px',
              width: '100%',
              padding: '2.5rem',
              position: 'relative',
              border: '1px solid rgba(217, 119, 6, 0.4)',
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.8)',
            }}
          >
            <button
              onClick={() => {
                setShowLoginModal(false);
                setLoginError(null);
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(217, 119, 6, 0.12)',
                color: 'var(--primary-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <Lock size={26} />
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.4rem' }}>
              Admin Dashboard Login
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.75rem' }}>
              Sign in to view anonymous usage analytics.
            </p>

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                  Username
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Admin username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                  Password
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
              </div>

              {loginError && (
                <div
                  style={{
                    color: 'var(--error)',
                    fontSize: '0.82rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                >
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}
              >
                Sign In to Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section
        style={{
          position: 'relative',
          padding: '5.5rem 2rem 4rem',
          maxWidth: '1100px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        {/* Soft background accent */}
        <div
          className="landing-ambient"
          style={{
            position: 'absolute',
            top: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '650px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(217, 119, 6, 0.07) 0%, transparent 70%)',
            filter: 'blur(45px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              border: '1px solid rgba(217, 119, 6, 0.3)',
              color: 'var(--primary-accent)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1.75rem',
            }}
          >
            <Shield size={15} />
            <span>Windows desktop app • Open source (GPL-3.0) • Files stay on your device</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5.5vw, 4.25rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: '1.25rem',
              letterSpacing: '-1.5px',
            }}
          >
            Convert files on Windows
            <br />
            <span
              style={{
                color: 'var(--primary-accent-hover)',
              }}
            >
              without uploading them.
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.2rem',
              color: 'var(--text-muted)',
              maxWidth: '750px',
              margin: '0 auto 2.5rem',
              lineHeight: 1.6,
            }}
          >
            Convert images, merge or split PDFs, extract audio from video, and manage ZIP files. Desktop work
            stays on your PC; browser conversions run locally in your browser.
          </p>

          {/* Main Action Hyperlinks */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '3rem',
            }}
          >
            <a
              href={releaseData.downloadUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('download_latest')}
              className="btn btn-primary"
              style={{
                padding: '0.85rem 2rem',
                fontSize: '1.05rem',
                boxShadow: '0 0 25px rgba(217, 119, 6, 0.35)',
              }}
            >
              <Download size={18} />
              Download Latest Release ({releaseData.version})
            </a>

            <a
              href={OFFICIAL_REPO}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('github_repo')}
              className="btn btn-secondary"
              style={{ padding: '0.85rem 1.6rem', fontSize: '1.05rem', gap: '0.5rem' }}
            >
              <GithubIcon size={18} />
              Official GitHub Repo
            </a>

            <Link
              to="/app"
              onClick={() => trackButtonClick('web_app_open')}
              className="btn btn-secondary"
              style={{ padding: '0.85rem 1.5rem', fontSize: '1.05rem', gap: '0.4rem' }}
            >
              <Globe size={17} style={{ color: 'var(--primary-accent)' }} />
              Open Web App
            </Link>
          </div>

          <div className="text-muted" style={{ fontSize: '0.85rem' }}>
            Installer: <code style={{ color: 'var(--primary-accent-hover)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{releaseData.installerName}</code> • No accounts, no ads, no limits.
          </div>
        </div>
      </section>

      {/* Live In-Browser Converter Section */}
      <section
        id="demo"
        style={{
          padding: '4rem 2rem',
          maxWidth: '950px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--primary-accent)',
              fontSize: '0.85rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '0.5rem',
            }}
          >
            <ImageIcon size={16} /> In-Browser Image Converter
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700 }}>
            Try Converting Files Right In Your Browser
          </h2>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0.5rem auto 0' }}>
            No upload to any server. Processes directly in your browser memory.
          </p>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: '2.5rem',
            border: '1px solid rgba(217, 119, 6, 0.3)',
            boxShadow: '0 0 35px rgba(0, 0, 0, 0.5)',
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleDemoFileSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {!demoFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-light)',
                borderRadius: '12px',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(217, 119, 6, 0.12)',
                  color: 'var(--primary-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <ImageIcon size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Select an Image from your Device
              </h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Supports PNG, JPG, JPEG, WebP, and AVIF (runs in browser memory)
              </p>
              <button className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                Browse Image
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '1rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <ImageIcon size={22} style={{ color: 'var(--primary-accent)' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{demoFile.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {(demoFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setDemoFile(null);
                    setConvertedResult(null);
                    setDemoError(null);
                    setConversionSuccess(false);
                  }}
                  style={{ fontSize: '0.85rem' }}
                >
                  Change File
                </button>
              </div>

              {/* Format selection */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Choose Target Format:
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {(['png', 'jpg', 'webp', 'avif'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        setDemoFormat(fmt);
                        setConvertedResult(null);
                        setDemoError(null);
                        setConversionSuccess(false);
                      }}
                      className="btn"
                      style={{
                        flex: 1,
                        background:
                          demoFormat === fmt ? 'rgba(217, 119, 6, 0.25)' : 'rgba(255,255,255,0.04)',
                        border:
                          demoFormat === fmt
                            ? '1px solid var(--primary-accent)'
                            : '1px solid var(--border-light)',
                        color: demoFormat === fmt ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '0.75rem',
                      }}
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality slider */}
              {demoFormat !== 'png' && (
                <div
                  style={{
                    background: 'rgba(217, 119, 6, 0.06)',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(217, 119, 6, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                      <Sliders size={16} style={{ color: 'var(--primary-accent)' }} />
                      Compression Quality
                    </label>
                    <span style={{ fontWeight: 700, color: 'var(--primary-accent)' }}>
                      {demoQuality}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={95}
                    value={demoQuality}
                    onChange={(e) => {
                      setDemoQuality(Number(e.target.value));
                      setConvertedResult(null);
                      setConversionSuccess(false);
                    }}
                    style={{ width: '100%', accentColor: 'var(--primary-accent)', cursor: 'pointer' }}
                  />
                </div>
              )}

              {/* Action buttons */}
              {demoError && (
                <p role="alert" style={{ color: 'var(--error)', margin: 0 }}>
                  {demoError}
                </p>
              )}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                {conversionSuccess && convertedResult ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => triggerBlobDownload(convertedResult.blob, convertedResult.fileName)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                      padding: '0.75rem 1.75rem',
                    }}
                  >
                    Download Converted {demoFormat.toUpperCase()} ({((convertedResult.blob.size) / 1024).toFixed(1)} KB)
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      trackButtonClick('try_demo');
                      void handleRunDemoConversion();
                    }}
                    disabled={isConverting}
                    style={{ padding: '0.75rem 2rem' }}
                  >
                    {isConverting ? 'Processing in Browser…' : 'Convert Client-Side'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Desktop Upsell banner */}
          <div
            style={{
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
            }}
          >
            <span className="text-muted">
              ⚡ Need to extract video audio with FFmpeg, batch process multi-GB PDFs, or zip archives?
            </span>
            <a
              href={LATEST_RELEASE}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('view_releases')}
              style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary-accent)' }}
            >
              Get Latest Windows Release <ChevronRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section
        id="features"
        style={{
          padding: '4rem 2rem 5rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Supported Conversion Operations
          </h2>
          <p className="text-muted" style={{ maxWidth: '650px', margin: '0 auto', fontSize: '1.1rem' }}>
            Desktop processing stays on your device; image conversions on this page stay in your browser. Anonymous analytics are optional.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {[
            {
              icon: <ImageIcon size={26} style={{ color: 'var(--primary-accent)' }} />,
              title: 'Image Converter & Compressor',
              desc: 'Convert JPG and PNG files, save images as WebP or AVIF, and compress JPEG or PNG images.',
              badge: 'Image tools',
            },
            {
              icon: <FileText size={26} style={{ color: '#f59e0b' }} />,
              title: 'PDF Merge & Page Split',
              desc: 'Combine multiple PDF documents or extract custom page ranges using native Rust lopdf.',
              badge: 'PDF tools',
            },
            {
              icon: <Video size={26} style={{ color: '#d97706' }} />,
              title: 'Video Audio Extraction',
              desc: 'Extract MP3 audio tracks directly from MP4, MKV, AVI, and MOV files via local FFmpeg.',
              badge: 'FFmpeg Engine',
            },
            {
              icon: <Archive size={26} style={{ color: '#10b981' }} />,
              title: 'ZIP Archive Tools',
              desc: 'Pack any collection of files into standard ZIP archives or extract them without bloat.',
              badge: 'Archive tools',
            },
            {
              icon: <Shield size={26} style={{ color: '#3b82f6' }} />,
              title: 'Local File Processing',
              desc: 'Desktop file processing stays local. Optional anonymous usage analytics can be disabled at any time.',
              badge: 'Files stay local',
            },
            {
              icon: <Zap size={26} style={{ color: '#ec4899' }} />,
              title: 'Tauri 2 + Rust Core',
              desc: 'A compact desktop interface with file processing handled by the Rust application core.',
              badge: 'Tauri 2',
            },
          ].map((f, i) => (
            <div
              key={i}
              className="glass-panel"
              style={{
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {f.icon}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    background: 'rgba(217, 119, 6, 0.12)',
                    color: 'var(--primary-accent-hover)',
                  }}
                >
                  {f.badge}
                </span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{f.title}</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Official Links & CTA Footer */}
      <section
        style={{
          padding: '5rem 2rem 4rem',
          borderTop: '1px solid var(--border-light)',
          background: 'linear-gradient(180deg, rgba(17,14,12,0) 0%, rgba(217,119,6,0.06) 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1rem' }}>
            Ready to Convert Files Locally?
          </h2>
          <p className="text-muted" style={{ fontSize: '1.1rem', marginBottom: '2.5rem' }}>
            Download AnyFile Convert for Windows directly from our official releases page.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <a
              href={releaseData.downloadUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('download_latest')}
              className="btn btn-primary"
              style={{ padding: '0.85rem 2rem', fontSize: '1.05rem' }}
            >
              <Download size={18} />
              Download Latest Release ({releaseData.version})
            </a>
            <a
              href={OFFICIAL_REPO}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('github_repo')}
              className="btn btn-secondary"
              style={{ padding: '0.85rem 1.6rem', fontSize: '1.05rem', gap: '0.5rem' }}
            >
              <GithubIcon size={18} />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-light)',
          padding: '2.5rem 2rem',
          backgroundColor: 'rgba(10, 8, 7, 0.7)',
          fontSize: '0.85rem',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 700 }}>AnyFile Convert</span>
            <span className="text-muted">© 2026. Licensed under GNU GPL-3.0.</span>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a
              href={OFFICIAL_REPO}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('github_repo')}
              style={{ color: 'var(--text-muted)' }}
            >
              Official GitHub
            </a>
            <a
              href={LATEST_RELEASE}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('view_releases')}
              style={{ color: 'var(--text-muted)' }}
            >
              Latest Releases
            </a>
            <a
              href={`${OFFICIAL_REPO}/blob/main/PRIVACY.md`}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackButtonClick('github_repo')}
              style={{ color: 'var(--text-muted)' }}
            >
              Privacy Policy
            </a>
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-accent)',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Admin Login
            </button>
          </div>
        </div>
      </footer>

      {analyticsConsent === null && (
        <aside
          role="dialog"
          aria-label="Anonymous analytics preference"
          className="landing-analytics-notice"
        >
          <div>
            <strong>Help improve AnyFile Convert?</strong>
            <p className="text-muted">
              Share anonymous button clicks and browser-demo conversions. Your files are never uploaded.
            </p>
          </div>
          <div className="landing-analytics-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                localStorage.setItem('anyfile_analytics_consent', 'no');
                setAnalyticsConsent(false);
              }}
            >
              No thanks
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                localStorage.setItem('anyfile_analytics_consent', 'yes');
                setAnalyticsConsent(true);
              }}
            >
              Allow analytics
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
