/**
 * This module provides a function to get the status of a game object in highways,
 * particularly for handling novice and respawn areas in Screeps.
 * @module screeps-get-object-status
 */

const STATUS_NORMAL = "normal"

/**
 * Gets the status of a room object or position.
 * If the object is in a highway room with walls, it will check the status of the adjacent room.
 * @param {RoomObject|RoomPosition} object - The object or position to check.
 * @returns {string} The status of the area where the object is in (e.g., "normal", "novice", "respawn").
 * @throws {Error} If the object is invalid, vision is lacking, or fails to determine.
 */
function getObjectStatus(object) {
  const objectPos = object.pos || object

  if (!objectPos || !(objectPos instanceof RoomPosition)) {
    throw new Error(`Invalid object`)
  }

  const roomName = objectPos.roomName
  const roomXY = roomNameToXY(roomName)
  const [roomX, roomY] = roomXY

  if ((roomX < 0 ? roomX + 1 : roomX) % 10 !== 0 && (roomY < 0 ? roomY + 1 : roomY) % 10 !== 0) {
    return Game.map.getRoomStatus(roomName).status
  }

  const room = Game.rooms[roomName]

  if (!room) {
    throw new Error(`Don't have vision`)
  }

  const costs = new PathFinder.CostMatrix()
  let isWall = false
  const exitWalls = {}

  room.find(FIND_STRUCTURES).forEach((s) => {
    if (s.structureType !== STRUCTURE_WALL) {
      return
    }

    isWall = true
    costs.set(s.pos.x, s.pos.y, 255)

    if (s.pos.x === 0) exitWalls[LEFT] = s
    else if (s.pos.x === 49) exitWalls[RIGHT] = s
    else if (s.pos.y === 0) exitWalls[TOP] = s
    else if (s.pos.y === 49) exitWalls[BOTTOM] = s
  })

  if (!isWall) {
    return STATUS_NORMAL
  }

  const roomCallback = (r) => (r === roomName ? costs : false)

  if (exitWalls[TOP] && exitWalls[BOTTOM] && !exitWalls[LEFT] && !exitWalls[RIGHT]) {
    const goals = [...room.find(FIND_EXIT_TOP), ...room.find(FIND_EXIT_BOTTOM)].map((exit) => ({ pos: exit, range: 0 }))
    const search = PathFinder.search(objectPos, goals, {
      roomCallback,
    })

    if (search.incomplete) throw new Error(`incomplete search`)

    const lastPos = search.path.pop()
    const wall = lastPos.y === 0 ? exitWalls[TOP] : exitWalls[BOTTOM]
    const dx = lastPos.x > wall.pos.x ? 1 : -1
    const checkRoomName = getRoomNameFromXY(roomX + dx, roomY)
    return Game.map.getRoomStatus(checkRoomName).status
  }

  if (exitWalls[LEFT] && exitWalls[RIGHT] && !exitWalls[TOP] && !exitWalls[BOTTOM]) {
    const goals = [...room.find(FIND_EXIT_LEFT), ...room.find(FIND_EXIT_RIGHT)].map((exit) => ({ pos: exit, range: 0 }))
    const search = PathFinder.search(objectPos, goals, {
      roomCallback,
    })

    if (search.incomplete) throw new Error(`incomplete search`)

    const lastPos = search.path.pop()
    const wall = lastPos.x === 0 ? exitWalls[LEFT] : exitWalls[RIGHT]
    const dy = lastPos.y > wall.pos.y ? 1 : -1
    const checkRoomName = getRoomNameFromXY(roomX, roomY + dy)
    return Game.map.getRoomStatus(checkRoomName).status
  }

  const exits = []
  for (const direction in exitWalls) {
    exits.push(...room.find(Number(direction)))
  }

  const goals = exits.map((exit) => ({ pos: exit, range: 0 }))
  const search = PathFinder.search(objectPos, goals, {
    roomCallback,
  })

  if (search.incomplete) throw new Error(`incomplete search`)

  const lastPos = search.path.pop()
  let firstDirection
  if (lastPos.x === 0) firstDirection = LEFT
  else if (lastPos.x === 49) firstDirection = RIGHT
  else if (lastPos.y === 0) firstDirection = TOP
  else firstDirection = BOTTOM

  const wall = exitWalls[firstDirection]
  let secondDirection
  if (firstDirection === TOP || firstDirection === BOTTOM) {
    secondDirection = lastPos.x > wall.pos.x ? RIGHT : LEFT
  } else {
    secondDirection = lastPos.y > wall.pos.y ? BOTTOM : TOP
  }

  const directions = [firstDirection, secondDirection]
  const dx = directions.includes(RIGHT) ? 1 : -1
  const dy = directions.includes(BOTTOM) ? 1 : -1
  const checkRoomName = getRoomNameFromXY(roomX + dx, roomY + dy)
  return Game.map.getRoomStatus(checkRoomName).status
}

/**
 * Converts room XY coordinates to a room name (e.g., "W1N1").
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @returns {string} The room name.
 */
function getRoomNameFromXY(x, y) {
  const xStr = x < 0 ? "W" + (-x - 1) : "E" + x
  const yStr = y < 0 ? "N" + (-y - 1) : "S" + y
  return xStr + yStr
}

/**
 * Converts a room name (e.g., "W1N1") to XY coordinates.
 * E0S0 is (0, 0) and (W0N0) is (-1, -1)
 * @param {string} name - The room name.
 * @returns {[number, number]} An array containing the x and y coordinates.
 */
function roomNameToXY(name) {
  let xx = parseInt(name.substr(1), 10)
  let verticalPos = 2
  if (xx >= 100) {
    verticalPos = 4
  } else if (xx >= 10) {
    verticalPos = 3
  }
  let yy = parseInt(name.substr(verticalPos + 1), 10)
  let horizontalDir = name.charAt(0)
  let verticalDir = name.charAt(verticalPos)
  if (horizontalDir === "W" || horizontalDir === "w") {
    xx = -xx - 1
  }
  if (verticalDir === "N" || verticalDir === "n") {
    yy = -yy - 1
  }
  return [xx, yy]
}

module.exports = getObjectStatus
