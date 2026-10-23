import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import API from '../API.js';

const minimumEquipment = (rules) => Object.fromEntries(
  rules.map((rule) => [rule.equipmentName, rule.mandatory ? rule.minQuantity : 0])
);

function ReservePage({ publicInfo, user, applyOperationResult, showError }) {
  const [facilityType, setFacilityType] = useState('');
  const [mode, setMode] = useState('direct');
  const [facilityCode, setFacilityCode] = useState('');
  const [equipment, setEquipment] = useState({});
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  const rules = publicInfo?.rules[facilityType] || [];

  const availableFacilities = publicInfo?.facilities.filter(
    (facility) => facility.type === facilityType && facility.available
  ) || [];

  const typeInfo = publicInfo?.types.find((type) => type.type === facilityType);

  useEffect(() => {
    if (!publicInfo) {
      return;
    }

    if (!facilityType && publicInfo.types.length > 0) {
      setFacilityType(publicInfo.types[0].type);
      return;
    }

    const currentRules = publicInfo.rules[facilityType] || [];
    const currentFacilities = publicInfo.facilities.filter(
      (facility) => facility.type === facilityType && facility.available
    );

    setEquipment(minimumEquipment(currentRules));
    setFacilityCode(currentFacilities[0] ? currentFacilities[0].code : '');
  }, [facilityType, publicInfo]);

  if (!publicInfo) {
    return <p>Reservation form is not available.</p>;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setWaiting(true);

    try {
      const request = mode === 'direct'
        ? { mode, facilityCode, equipment }
        : { mode, facilityType, equipment };

      const result = await API.createReservation(request);

      applyOperationResult(result);
      setEquipment(minimumEquipment(rules));
    } catch (err) {
      setError(err.error || 'Reservation failed.');
      showError(err);
    } finally {
      setWaiting(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <h1>Reserve a facility</h1>
        <p>Choose the facility type and equipment. Automatic mode assigns only the facility.</p>
      </div>

      {user.score < 0 ? (
        <Alert variant="warning">
          Your negative score permits only the mandatory minimum equipment.
        </Alert>
      ) : null}

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Form onSubmit={submit}>
        <Row className="g-4">
          <Col lg={5}>
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <Card.Title>Facility</Card.Title>

                <Form.Group className="mb-3" controlId="facility-type">
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={facilityType}
                    disabled={waiting}
                    onChange={(event) => setFacilityType(event.target.value)}
                  >
                    {publicInfo.types.map((type) => (
                      <option key={type.type} value={type.type}>
                        {type.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <p>
                  <Badge bg={typeInfo?.available ? 'success' : 'danger'}>
                    {typeInfo?.available || 0} available
                  </Badge>
                </p>

                <Form.Check
                  type="radio"
                  name="selection-mode"
                  label="Direct selection"
                  checked={mode === 'direct'}
                  disabled={waiting}
                  onChange={() => setMode('direct')}
                />

                <Form.Check
                  type="radio"
                  name="selection-mode"
                  label="Automatic assignment within this type"
                  checked={mode === 'automatic'}
                  disabled={waiting}
                  onChange={() => setMode('automatic')}
                />

                {mode === 'direct' ? (
                  <Form.Group className="mt-3" controlId="facility-code">
                    <Form.Label>Available facility</Form.Label>

                    <Form.Select
                      value={facilityCode}
                      disabled={waiting || !availableFacilities.length}
                      onChange={(event) => setFacilityCode(event.target.value)}
                    >
                      {!availableFacilities.length ? (
                        <option value="">No available facility</option>
                      ) : null}

                      {availableFacilities.map((facility) => (
                        <option key={facility.code} value={facility.code}>
                          {facility.label} ({facility.code})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                ) : (
                  <p className="mt-3">
                    The server will choose an available {typeInfo?.label.toLowerCase()}.
                  </p>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={7}>
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <Card.Title>Equipment</Card.Title>

                {rules.map((rule) => {
                  const stock = publicInfo.equipment.find((item) => item.name === rule.equipmentName);
                  const min = rule.mandatory ? rule.minQuantity : 0;
                  const max = user.score < 0 ? min : stock?.available || 0;

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
                        value={equipment[rule.equipmentName] ?? min}
                        disabled={waiting || user.score < 0}
                        onChange={(event) => setEquipment((old) => ({
                          ...old,
                          [rule.equipmentName]: Number(event.target.value),
                        }))}
                      />

                      <Form.Text>{stock?.available || 0} currently available</Form.Text>
                    </Form.Group>
                  );
                })}

                <Button
                  type="submit"
                  disabled={waiting || !typeInfo?.available || (mode === 'direct' && !facilityCode)}
                >
                  {waiting ? 'Reserving…' : 'Confirm reservation'}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Form>
    </>
  );
}

export { ReservePage };