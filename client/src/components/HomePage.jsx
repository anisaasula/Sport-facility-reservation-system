import { Badge, Card, Col, Row, Table } from 'react-bootstrap';

function HomePage({ publicInfo }) {
  if (!publicInfo) {
    return <p>Availability is not available.</p>;
  }

  return (
    <>
      <div className="page-heading">
        <h1>Sport center availability</h1>
        <p>Current facility and equipment availability is visible to everyone.</p>
      </div>

      <Row className="g-3 mb-4">
        {publicInfo.types.map((type) => (
          <Col sm={6} md={4} lg={2} key={type.type}>
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <Card.Title className="h6">{type.label}</Card.Title>
                <Badge bg={type.available ? 'success' : 'danger'}>
                  {type.available} / {type.total}
                </Badge>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4">
        <Col lg={7}>
          <Card className="shadow-sm">
            <Card.Body>
              <h2>Equipment</h2>

              <Table striped bordered responsive>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Total</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {publicInfo.equipment.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.totalQuantity}</td>
                      <td>{item.available}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="shadow-sm">
            <Card.Body>
              <h2>Facilities</h2>

              <div className="facility-map">
                {publicInfo.facilities.map((facility) => (
                  <div
                    key={facility.code}
                    className={`facility-tile ${facility.available ? 'available' : 'booked'}`}
                  >
                    <strong>{facility.code}</strong>
                    <span>{facility.label}</span>
                    <small>{facility.available ? 'Available' : 'Booked'}</small>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export { HomePage };