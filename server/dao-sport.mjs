import db from './db.mjs';

const FACILITY_TYPES = ['tennis', 'basketball', 'volleyball', 'soccer', 'table-tennis', 'cycling'];

const facilityTypeLabels = {
  tennis: 'Tennis court',
  basketball: 'Basketball court',
  volleyball: 'Volleyball court',
  soccer: 'Soccer field',
  'table-tennis': 'Table tennis table',
  cycling: 'Cycling track'
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const apiError = (status, error) => ({ status, error });

const groupEquipment = (rows) => {
  const equipment = {};

  for (const row of rows) {
    equipment[row.equipmentName] = row.quantity;
  }

  return equipment;
};

const getRules = async (facilityType) => {
  return await all(
    `SELECT facilityType, equipmentName, minQuantity, mandatory
     FROM facility_equipment_rules
     WHERE facilityType = ?
     ORDER BY mandatory DESC, equipmentName`,
    [facilityType]
  );
};

const getEquipmentAvailability = async (excludeReservationId = null) => {
  const rows = await all(
    `SELECT e.name, e.totalQuantity, COALESCE(SUM(re.quantity), 0) AS used
     FROM equipment e
     LEFT JOIN reservation_equipment re ON re.equipmentName = e.name
       AND (? IS NULL OR re.reservationId <> ?)
     GROUP BY e.name, e.totalQuantity
     ORDER BY e.name`,
    [excludeReservationId, excludeReservationId]
  );

  return rows.map((row) => ({
    name: row.name,
    totalQuantity: row.totalQuantity,
    used: row.used,
    available: row.totalQuantity - row.used
  }));
};

const getFacilitiesWithAvailability = async () => {
  const rows = await all(
    `SELECT f.code, f.type, f.label,
            CASE WHEN r.id IS NULL THEN 1 ELSE 0 END AS available
     FROM facilities f
     LEFT JOIN reservations r ON r.facilityCode = f.code
     ORDER BY f.type, f.code`
  );

  return rows.map((row) => ({
    code: row.code,
    type: row.type,
    typeLabel: facilityTypeLabels[row.type],
    label: row.label,
    available: row.available === 1
  }));
};

const getPublicInfo = async () => {
  const facilities = await getFacilitiesWithAvailability();
  const equipment = await getEquipmentAvailability();

  const ruleRows = await all(
    `SELECT facilityType, equipmentName, minQuantity, mandatory
     FROM facility_equipment_rules
     ORDER BY facilityType, mandatory DESC, equipmentName`
  );

  const types = FACILITY_TYPES.map((type) => {
    const typeFacilities = facilities.filter((facility) => facility.type === type);

    return {
      type,
      label: facilityTypeLabels[type],
      total: typeFacilities.length,
      available: typeFacilities.filter((facility) => facility.available).length
    };
  });

  const rules = {};

  for (const type of FACILITY_TYPES) {
    rules[type] = ruleRows
      .filter((rule) => rule.facilityType === type)
      .map((rule) => ({
        equipmentName: rule.equipmentName,
        minQuantity: rule.minQuantity,
        mandatory: rule.mandatory === 1
      }));
  }

  return { types, facilities, equipment, rules };
};

const validateEquipment = async (facilityType, requestedEquipment) => {
  const rules = await getRules(facilityType);
  const ruleByName = new Map(rules.map((rule) => [rule.equipmentName, rule]));
  const cleaned = {};

  if (!requestedEquipment || typeof requestedEquipment !== 'object' || Array.isArray(requestedEquipment)) {
    return apiError(422, 'Invalid equipment request');
  }

  for (const [name, value] of Object.entries(requestedEquipment)) {
    if (!ruleByName.has(name)) {
      return apiError(422, `Equipment ${name} is not allowed for this facility type`);
    }

    const quantity = Number(value);

    if (!Number.isInteger(quantity) || quantity < 0) {
      return apiError(422, `Invalid quantity for ${name}`);
    }

    if (quantity > 0) {
      cleaned[name] = quantity;
    }
  }

  for (const rule of rules) {
    const quantity = cleaned[rule.equipmentName] || 0;

    if (rule.mandatory === 1 && quantity < rule.minQuantity) {
      return apiError(422, `At least ${rule.minQuantity} ${rule.equipmentName} required`);
    }
  }

  return {
    equipment: cleaned,
    rules
  };
};

const checkNegativeScoreCreation = (equipment, rules) => {
  for (const rule of rules) {
    const quantity = equipment[rule.equipmentName] || 0;

    if (rule.mandatory === 1 && quantity !== rule.minQuantity) {
      return apiError(422, 'Users with negative score can reserve only the minimum required equipment');
    }

    if (rule.mandatory !== 1 && quantity > 0) {
      return apiError(422, 'Users with negative score cannot request optional equipment');
    }
  }

  return false;
};

const checkNegativeScoreModification = (oldEquipment, newEquipment, rules) => {
  const ruleByName = new Map(rules.map((rule) => [rule.equipmentName, rule]));

  const names = new Set([
    ...Object.keys(oldEquipment),
    ...Object.keys(newEquipment),
    ...rules.map((rule) => rule.equipmentName)
  ]);

  for (const name of names) {
    const oldQuantity = oldEquipment[name] || 0;
    const newQuantity = newEquipment[name] || 0;
    const rule = ruleByName.get(name);

    if (newQuantity > oldQuantity) {
      return apiError(422, 'Users with negative score can only remove extra equipment, not add equipment');
    }

    if (rule && rule.mandatory === 1 && newQuantity < rule.minQuantity) {
      return apiError(422, `At least ${rule.minQuantity} ${name} required`);
    }
  }

  return false;
};

const checkEquipmentAvailability = async (requestedEquipment, excludeReservationId = null) => {
  const equipmentAvailability = await getEquipmentAvailability(excludeReservationId);
  const availableByName = new Map(equipmentAvailability.map((item) => [item.name, item.available]));

  for (const [name, quantity] of Object.entries(requestedEquipment)) {
    const available = availableByName.get(name) || 0;

    if (quantity > available) {
      return apiError(409, `Not enough equipment of type ${name}. Available: ${available}`);
    }
  }

  return false;
};

const checkRebookingDelay = async (userId, facilityType) => {
  const row = await get(
    `SELECT releasedAt
     FROM released_facility_types
     WHERE userId = ? AND facilityType = ?
     ORDER BY releasedAt DESC
     LIMIT 1`,
    [userId, facilityType]
  );

  if (!row) {
    return false;
  }

  const elapsedSeconds = Math.floor(Date.now() / 1000) - row.releasedAt;

  if (elapsedSeconds < 30) {
    const remaining = Math.ceil(30 - elapsedSeconds);
    return apiError(409, `Too early to reserve a ${facilityTypeLabels[facilityType]} again. Wait ${remaining} seconds`);
  }

  return false;
};

const getAvailableFacilityByCode = async (facilityCode) => {
  return await get(
    `SELECT f.code, f.type, f.label
     FROM facilities f
     LEFT JOIN reservations r ON r.facilityCode = f.code
     WHERE f.code = ? AND r.id IS NULL`,
    [facilityCode]
  );
};

const getFirstAvailableFacilityByType = async (facilityType) => {
  return await get(
    `SELECT f.code, f.type, f.label
     FROM facilities f
     LEFT JOIN reservations r ON r.facilityCode = f.code
     WHERE f.type = ? AND r.id IS NULL
     ORDER BY f.code
     LIMIT 1`,
    [facilityType]
  );
};

const insertReservationEquipment = async (reservationId, equipment) => {
  for (const [equipmentName, quantity] of Object.entries(equipment)) {
    await run(
      'INSERT INTO reservation_equipment(reservationId, equipmentName, quantity) VALUES (?, ?, ?)',
      [reservationId, equipmentName, quantity]
    );
  }
};

const createReservation = async (user, request) => {
  if (!request || !['direct', 'automatic'].includes(request.mode)) {
    return apiError(422, 'Invalid facility selection mode');
  }

  let facility;

  if (request.mode === 'direct') {
    if (!request.facilityCode) {
      return apiError(422, 'Missing facility code');
    }

    facility = await getAvailableFacilityByCode(request.facilityCode);

    if (!facility) {
      return apiError(409, 'The selected facility is not available');
    }
  } else {
    if (!FACILITY_TYPES.includes(request.facilityType)) {
      return apiError(422, 'Invalid facility type');
    }

    facility = await getFirstAvailableFacilityByType(request.facilityType);

    if (!facility) {
      return apiError(409, 'Not enough facilities of the selected type');
    }
  }

  const delayError = await checkRebookingDelay(user.id, facility.type);

  if (delayError) {
    return delayError;
  }

  const validated = await validateEquipment(facility.type, request.equipment);

  if (validated.error) {
    return validated;
  }

  if (user.score < 0) {
    const negativeScoreError = checkNegativeScoreCreation(validated.equipment, validated.rules);

    if (negativeScoreError) {
      return negativeScoreError;
    }
  }

  const stockError = await checkEquipmentAvailability(validated.equipment);

  if (stockError) {
    return stockError;
  }

  try {
    const result = await run(
      'INSERT INTO reservations(userId, facilityCode, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [user.id, facility.code]
    );

    await insertReservationEquipment(result.lastID, validated.equipment);

    return {
      id: result.lastID,
      facilityCode: facility.code,
      facilityLabel: facility.label
    };
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return apiError(409, 'The selected facility is not available');
    }

    throw err;
  }
};

const getReservationEquipment = async (reservationId) => {
  const rows = await all(
    `SELECT equipmentName, quantity
     FROM reservation_equipment
     WHERE reservationId = ?
     ORDER BY equipmentName`,
    [reservationId]
  );

  return groupEquipment(rows);
};

const listReservations = async (userId) => {
  const reservations = await all(
    `SELECT r.id, r.facilityCode, r.createdAt,
            f.type AS facilityType, f.label AS facilityLabel
     FROM reservations r
     JOIN facilities f ON f.code = r.facilityCode
     WHERE r.userId = ?
     ORDER BY r.id`,
    [userId]
  );

  for (const reservation of reservations) {
    reservation.facilityTypeLabel = facilityTypeLabels[reservation.facilityType];
    reservation.equipment = await getReservationEquipment(reservation.id);
  }

  return reservations;
};

const getReservationById = async (userId, reservationId) => {
  return await get(
    `SELECT r.id, r.userId, r.facilityCode,
            f.type AS facilityType, f.label AS facilityLabel
     FROM reservations r
     JOIN facilities f ON f.code = r.facilityCode
     WHERE r.id = ? AND r.userId = ?`,
    [reservationId, userId]
  );
};

const updateReservation = async (user, reservationId, request) => {
  const reservation = await getReservationById(user.id, reservationId);

  if (!reservation) {
    return apiError(404, 'Reservation not found');
  }

  const oldEquipment = await getReservationEquipment(reservationId);
  const validated = await validateEquipment(reservation.facilityType, request.equipment);

  if (validated.error) {
    return validated;
  }

  if (user.score < 0) {
    const negativeScoreError = checkNegativeScoreModification(
      oldEquipment,
      validated.equipment,
      validated.rules
    );

    if (negativeScoreError) {
      return negativeScoreError;
    }
  }

  const stockError = await checkEquipmentAvailability(validated.equipment, reservationId);

  if (stockError) {
    return stockError;
  }

  await run('DELETE FROM reservation_equipment WHERE reservationId = ?', [reservationId]);
  await insertReservationEquipment(reservationId, validated.equipment);

  return { id: reservationId };
};

const deleteReservation = async (userId, reservationId) => {
  const reservation = await getReservationById(userId, reservationId);

  if (!reservation) {
    return apiError(404, 'Reservation not found');
  }

  await run('DELETE FROM reservations WHERE id = ? AND userId = ?', [reservationId, userId]);
  await run('UPDATE users SET score = score - 1 WHERE id = ?', [userId]);

  await run(
    "INSERT INTO released_facility_types(userId, facilityType, releasedAt) VALUES (?, ?, CAST(strftime('%s', 'now') AS INTEGER))",
    [userId, reservation.facilityType]
  );

  return {
    facilityType: reservation.facilityType,
    facilityTypeLabel: facilityTypeLabels[reservation.facilityType]
  };
};

export default {
  getPublicInfo,
  createReservation,
  listReservations,
  updateReservation,
  deleteReservation
};