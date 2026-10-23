import { useEffect, useState } from 'react';
import { Alert, Container, Spinner } from 'react-bootstrap';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router';
import API from './API.js';
import { Navigation } from './components/Navigation.jsx';
import { LoginPage, TotpPage } from './components/Auth.jsx';
import { HomePage } from './components/HomePage.jsx';
import { ReservePage } from './components/ReservePage.jsx';
import { ReservationsPage } from './components/ReservationsPage.jsx';
import './App.css';

function App() {
  const [publicInfo, setPublicInfo] = useState(null);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const info = await API.getPublicInfo();
        setPublicInfo(info);

        try {
          const currentUser = await API.getUserInfo();
          setUser(currentUser);
        } catch {
          setUser(null);
        }
      } catch (err) {
        setMessage({ variant: 'danger', text: err.error || 'Cannot load application data.' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const login = async (credentials) => {
    const loggedUser = await API.logIn(credentials);
    setUser(loggedUser);
    setMessage(null);

    if (loggedUser.canDoTotp && !loggedUser.isTotp) {
      navigate('/totp');
    } else {
      navigate('/reserve');
    }
  };

  const completeTotp = (loggedUser) => {
    setUser(loggedUser);
    setMessage({ variant: 'success', text: 'Two-factor authentication completed. Score reset to zero.' });
    navigate('/reserve');
  };

  const skipTotp = () => {
    setMessage({ variant: 'info', text: 'Logged in without two-factor authentication. Score was not reset.' });
    navigate('/reserve');
  };

  const logout = async () => {
    try {
      await API.logOut();
    } catch {

    }

    setUser(null);
    setMessage(null);
    navigate('/');
  };

  const applyOperationResult = (result) => {
    if (result.user) {
      setUser(result.user);
    }

    if (result.publicInfo) {
      setPublicInfo(result.publicInfo);
    }

    if (result.message) {
      setMessage({ variant: 'success', text: result.message });
    }
  };

  const showError = (err) => {
    setMessage({ variant: 'danger', text: err.error || 'Unexpected error.' });
  };

  if (loading) {
    return (
      <Container className="py-4">
        <Spinner animation="border" />
      </Container>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout user={user} logout={logout} message={message} setMessage={setMessage} />}>
        <Route path="/" element={<HomePage publicInfo={publicInfo} />} />

        <Route
          path="/login"
          element={!user ? <LoginPage login={login} /> : <Navigate replace to={user.canDoTotp && !user.isTotp ? '/totp' : '/reserve'} />}
        />

        <Route
          path="/totp"
          element={
            user && user.canDoTotp && !user.isTotp
              ? <TotpPage completeTotp={completeTotp} skipTotp={skipTotp} />
              : <Navigate replace to={user ? '/reserve' : '/login'} />
          }
        />

        <Route
          path="/reserve"
          element={
            user
              ? <ReservePage publicInfo={publicInfo} user={user} applyOperationResult={applyOperationResult} showError={showError} />
              : <Navigate replace to="/login" />
          }
        />

        <Route
          path="/reservations"
          element={
            user
              ? <ReservationsPage publicInfo={publicInfo} user={user} applyOperationResult={applyOperationResult} showError={showError} />
              : <Navigate replace to="/login" />
          }
        />

        <Route path="*" element={<h1>Page not found</h1>} />
      </Route>
    </Routes>
  );
}

function MainLayout({ user, logout, message, setMessage }) {
  return (
    <>
      <Navigation user={user} logout={logout} />

      <Container fluid="lg" className="py-4">
        {message ? (
          <Alert variant={message.variant} dismissible onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        ) : null}

        <Outlet />
      </Container>
    </>
  );
}

export default App;