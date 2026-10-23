import { Button, Container, Nav, Navbar, Badge } from 'react-bootstrap';
import { NavLink } from 'react-router';

function Navigation({ user, logout }) {
  return (
    <Navbar bg="primary" variant="dark" expand="md">
      <Container fluid="lg">
        <Navbar.Brand as={NavLink} to="/">
          Sport Center
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-navbar" />

        <Navbar.Collapse id="main-navbar">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/">
              Availability
            </Nav.Link>

            {user ? (
              <>
                <Nav.Link as={NavLink} to="/reserve">
                  Reserve
                </Nav.Link>
                <Nav.Link as={NavLink} to="/reservations">
                  My reservations
                </Nav.Link>
                {user.canDoTotp && !user.isTotp ? (
                  <Nav.Link as={NavLink} to="/totp">
                    Complete 2FA
                  </Nav.Link>
                ) : null}
              </>
            ) : null}
          </Nav>

          <Nav className="align-items-center">
            {user ? (
              <>
                <Navbar.Text className="me-3">
                  {user.name} · score{' '}
                  <Badge bg={user.score < 0 ? 'warning' : 'light'} text={user.score < 0 ? 'dark' : 'dark'}>
                    {user.score}
                  </Badge>
                  {user.isTotp ? ' · 2FA' : ''}
                </Navbar.Text>
                <Button variant="outline-light" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <Nav.Link as={NavLink} to="/login">
                Login
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export { Navigation };