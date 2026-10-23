import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import API from '../API.js';

function ReservationsPage({ publicInfo, user, applyOperationResult, showError }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waitingId, setWaitingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.getReservations()
      .then(setReservations)
      .catch((err) => setError(err.error || 'Cannot load reservations.'))
      .finally(() => setLoading(false));
  }, []);

  const runOperation = async (reservationId, operation) => {
    setWaitingId(reservationId);
    setError('');

    try {
      const result = await operation();

      if (result.reservations) {
        setReservations(result.reservations);
      }

      applyOperationResult(result);
    } catch (err) {
      setError(err.error || 'Operation failed.');
      showError(err);
    } finally {
      setWaitingId(null);
    }
  };

  if (loading || !publicInfo) {
    return <Spinner animation="border" />;
  }

  return (
    <>
      <div className="page-heading">
        <h1>My reservations</h1>
        <p>Equipment can be changed without changing the reserved facility.</p>
      </div>

      {user.score < 0 ? (
        <Alert variant="warning">
          Your score is negative. You may only reduce equipment quantities, while keeping mandatory minimums.
        </Alert>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {!reservations.length ? <p>You have no reservations.</p> : null}

      <Row className="g-4">
        {reservations.map((reservation) => (
          <Col lg={6} key={reservation.id}>
            <ReservationCard
              reservation={reservation}
              rules={publicInfo.rules[reservation.facilityType]}
              user={user}
              waiting={waitingId === reservation.id}
              save={(equipment) => runOperation(
                reservation.id,
                () => API.updateReservation(reservation.id, equipment)
              )}
              remove={() => runOperation(
                reservation.id,
                () => API.deleteReservation(reservation.id)
              )}
            />
          </Col>
        ))}
      </Row>
    </>
  );
}

function ReservationCard({ reservation, rules, user, waiting, save, remove }) {
  const initialEquipment = () => Object.fromEntries(
    rules.map((rule) => [rule.equipmentName, reservation.equipment[rule.equipmentName] || 0])
  );

  const [equipment, setEquipment] = useState(initialEquipment);

  useEffect(() => {
    setEquipment(Object.fromEntries(
      rules.map((rule) => [rule.equipmentName, reservation.equipment[rule.equipmentName] || 0])
    ));
  }, [reservation, rules]);

  return (
    <Card className="h-100 shadow-sm">
      <Card.Body>
        <Card.Title>
          {reservation.facilityLabel}{' '}
          <Badge bg="secondary">{reservation.facilityCode}</Badge>
        </Card.Title>

        <Card.Subtitle className="mb-3 text-muted">
          {reservation.facilityTypeLabel}
        </Card.Subtitle>

        <Form>
          {rules.map((rule) => {
            const min = rule.mandatory ? rule.minQuantity : 0;
            const original = reservation.equipment[rule.equipmentName] || 0;
            const max = user.score < 0 ? original : 99;

            return (
              <Form.Group className="mb-3" key={rule.equipmentName}>
                <Form.Label>
                  {rule.equipmentName}{' '}
                  <Badge bg={rule.mandatory ? 'primary' : 'secondary'}>
                    {rule.mandatory ? `minimum ${min}` : 'optional'}
                  </Badge>
                </Form.Label>

                <Form.Control
                  type="number"
                  min={min}
                  max={max}
                  value={equipment[rule.equipmentName] ?? 0}
                  disabled={waiting}
                  onChange={(event) => setEquipment((old) => ({
                    ...old,
                    [rule.equipmentName]: Number(event.target.value),
                  }))}
                />
              </Form.Group>
            );
          })}
        </Form>

        <Button disabled={waiting} onClick={() => save(equipment)}>
          {waiting ? 'Working…' : 'Save equipment'}
        </Button>

        <Button className="ms-2" variant="danger" disabled={waiting} onClick={remove}>
          Delete reservation
        </Button>
      </Card.Body>
    </Card>
  );
}

export { ReservationsPage };