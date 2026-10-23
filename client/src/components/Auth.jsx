import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import API from '../API.js';

function LoginPage({ login }) {
  const [username, setUsername] = useState('u1@p.it');
  const [password, setPassword] = useState('pwd1');
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!username) {
      setError('Email is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    setWaiting(true);

    try {
      await login({ username, password });
    } catch (err) {
      setError(err.error || 'Login failed.');
    } finally {
      setWaiting(false);
    }
  };

  return (
    <Row className="justify-content-center">
      <Col md={7} lg={5}>
        <Card className="shadow-sm">
          <Card.Body>
            <h1 className="mb-3">Login</h1>

            {error ? <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert> : null}

            <Form onSubmit={submit}>
              <Form.Group className="mb-3" controlId="username">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={username}
                  disabled={waiting}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="password">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  disabled={waiting}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Form.Group>

              <Button type="submit" disabled={waiting}>
                {waiting ? 'Logging in…' : 'Login'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

function TotpPage({ completeTotp, skipTotp }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (code === '' || code.length !== 6) {
      setError('Invalid content in form: either empty or not 6-char long.');
      return;
    }

    setWaiting(true);

    try {
      const user = await API.verifyTotp(code);
      completeTotp(user);
    } catch (err) {
      setError(err.error || 'Wrong code, please try again.');
    } finally {
      setWaiting(false);
    }
  };

  return (
    <Row className="justify-content-center">
      <Col md={7} lg={5}>
        <Card className="shadow-sm">
          <Card.Body>
            <h1 className="mb-3">Second Factor Authentication</h1>
            <h5>Please enter the code that you read on your device</h5>
            <p>A successful TOTP verification resets your score to zero.</p>

            {error ? <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert> : null}

            <Form onSubmit={submit}>
              <Form.Group className="mb-3" controlId="totp-code">
                <Form.Label>Code</Form.Label>
                <Form.Control
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  disabled={waiting}
                  onChange={(event) => setCode(event.target.value)}
                />
              </Form.Group>

              <Button className="my-2" type="submit" disabled={waiting}>
                {waiting ? 'Checking…' : 'Validate'}
              </Button>

              <Button
                className="my-2 mx-2"
                variant="danger"
                disabled={waiting}
                onClick={skipTotp}
              >
                Skip
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export { LoginPage, TotpPage };