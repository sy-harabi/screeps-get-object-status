/**
 * This module helps determine if a game object is located within protected, inaccessible areas
 * (novice or respawn zones) in Screeps highway rooms, preventing bots from wasting resources
 * trying to reach technically visible but inaccessible objects.
 * @module screeps-get-object-status
 */

const STATUS_NORMAL = "normal"

/**
 * Determines the status of the room containing the given object or position.
 * For highway rooms with walls, it checks the status of the adjacent room to identify
 * if the object is located within a protected, inaccessible area (novice or respawn zone).
 *
 * @param {RoomObject|RoomPosition} object - The object or position to check.
 * @returns {string} The status of the area where the object is located (e.g., "normal", "novice", "respawn").
 * @throws {Error} If the provided object is invalid, vision is lacking for the room, or the status cannot be determined.
 */
function getObjectStatus(object) {
  // Ensure we have a RoomPosition object to work with.
  const objectPos = object.pos || object

  if (!objectPos || !(objectPos instanceof RoomPosition)) {
    throw new Error("Invalid object: Expected a RoomObject or RoomPosition.")
  }

  const roomName = objectPos.roomName
  const [roomX, roomY] = roomNameToXY(roomName)

  // If the room is not a highway room,
  // return its status directly from Game.map.
  if ((roomX < 0 ? roomX + 1 : roomX) % 10 !== 0 && (roomY < 0 ? roomY + 1 : roomY) % 10 !== 0) {
    return Game.map.getRoomStatus(roomName).status
  }

  // We need vision.
  const room = Game.rooms[roomName]
  if (!room) {
    throw new Error("Don't have vision for room " + roomName + ".")
  }

  const costs = new PathFinder.CostMatrix()
  let isWall = false
  const exitWalls = {} // Stores wall structures located at room exits.

  // Iterate through all structures in the room to find walls.
  room.find(FIND_STRUCTURES).forEach((s) => {
    if (s.structureType !== STRUCTURE_WALL) {
      return // Skip non-wall structures.
    }

    isWall = true
    // Mark walls as unpathable in the cost matrix.
    costs.set(s.pos.x, s.pos.y, 255)

    // Identify if the wall is located at a room exit and store it.
    if (s.pos.x === 0) exitWalls[LEFT] = s
    else if (s.pos.x === 49) exitWalls[RIGHT] = s
    else if (s.pos.y === 0) exitWalls[TOP] = s
    else if (s.pos.y === 49) exitWalls[BOTTOM] = s
  })

  // If no walls are found in the room, it should be a normal room.
  if (!isWall) {
    return STATUS_NORMAL
  }

  // Define a room callback for PathFinder to use the custom cost matrix. Block the walls and do not allow other rooms.
  const roomCallback = (r) => (r === roomName ? costs : false)

  // Case 1: Highway room with only vertical walls (blocking horizontal movement).
  if (exitWalls[TOP] && exitWalls[BOTTOM] && !exitWalls[LEFT] && !exitWalls[RIGHT]) {
    // Pathfind to the top and bottom exits to determine which side of the wall the object is on.
    const goals = [...room.find(FIND_EXIT_TOP), ...room.find(FIND_EXIT_BOTTOM)].map((exit) => ({ pos: exit, range: 0 }))
    const search = PathFinder.search(objectPos, goals, {
      roomCallback,
    })

    if (search.incomplete) throw new Error("Incomplete pathfinding search for vertical walls.")

    // Get the last position in the path, which is closest to an exit.
    const lastPos = search.path.pop()

    // Determine which wall (top or bottom) the path leads towards.
    const wall = lastPos.y === 0 ? exitWalls[TOP] : exitWalls[BOTTOM]

    // Calculate the x-direction delta to the adjacent room.
    // If the last position is to the right of the wall, the adjacent room is to the right (+1).
    // Otherwise, it's to the left (-1).
    const dx = lastPos.x > wall.pos.x ? 1 : -1
    const checkRoomName = getRoomNameFromXY(roomX + dx, roomY)

    // Return the status of the adjacent room.
    return Game.map.getRoomStatus(checkRoomName).status
  }

  // Case 2: Highway room with only horizontal walls (blocking vertical movement).
  if (exitWalls[LEFT] && exitWalls[RIGHT] && !exitWalls[TOP] && !exitWalls[BOTTOM]) {
    // Pathfind to the left and right exits.
    const goals = [...room.find(FIND_EXIT_LEFT), ...room.find(FIND_EXIT_RIGHT)].map((exit) => ({ pos: exit, range: 0 }))
    const search = PathFinder.search(objectPos, goals, {
      roomCallback,
    })

    if (search.incomplete) throw new Error("Incomplete pathfinding search for horizontal walls.")

    const lastPos = search.path.pop()
    const wall = lastPos.x === 0 ? exitWalls[LEFT] : exitWalls[RIGHT]

    // Calculate the y-direction delta to the adjacent room.
    // If the last position is below the wall, the adjacent room is below (+1).
    // Otherwise, it's above (-1).
    const dy = lastPos.y > wall.pos.y ? 1 : -1
    const checkRoomName = getRoomNameFromXY(roomX, roomY + dy)

    // Return the status of the adjacent room.
    return Game.map.getRoomStatus(checkRoomName).status
  }

  // Case 3: Highway room with corner walls.
  const exits = []
  for (const direction in exitWalls) {
    exits.push(...room.find(Number(direction)))
  }

  const goals = exits.map((exit) => ({ pos: exit, range: 0 }))
  const search = PathFinder.search(objectPos, goals, {
    roomCallback,
  })

  if (search.incomplete) throw new Error("Incomplete pathfinding search for corner walls.")

  const lastPos = search.path.pop()
  let firstDirection
  // Determine the first direction of the exit found.
  if (lastPos.x === 0) firstDirection = LEFT
  else if (lastPos.x === 49) firstDirection = RIGHT
  else if (lastPos.y === 0) firstDirection = TOP
  else firstDirection = BOTTOM

  const wall = exitWalls[firstDirection]

  let secondDirection
  // Determine the secondary direction based on the position relative to the wall.
  if (firstDirection === TOP || firstDirection === BOTTOM) {
    secondDirection = lastPos.x > wall.pos.x ? RIGHT : LEFT
  } else {
    secondDirection = lastPos.y > wall.pos.y ? BOTTOM : TOP
  }

  // Combine the determined directions to calculate the adjacent room's coordinates.
  const directions = [firstDirection, secondDirection]
  const dx = directions.includes(RIGHT) ? 1 : -1
  const dy = directions.includes(BOTTOM) ? 1 : -1
  const checkRoomName = getRoomNameFromXY(roomX + dx, roomY + dy)

  // Return the status of the adjacent room.
  return Game.map.getRoomStatus(checkRoomName).status
}

/**
 * Converts room XY coordinates to a Screeps room name format (e.g., "W1N1").
 * @param {number} x - The x-coordinate of the room.
 * @param {number} y - The y-coordinate of the room.
 * @returns {string} The formatted room name.
 */
function getRoomNameFromXY(x, y) {
  const xStr = x < 0 ? "W" + (-x - 1) : "E" + x
  const yStr = y < 0 ? "N" + (-y - 1) : "S" + y
  return xStr + yStr
}

/**
 * Converts a Screeps room name (e.g., "W1N1") to its XY coordinates.
 * Note: E0S0 corresponds to (0, 0) and W0N0 corresponds to (-1, -1).
 * @param {string} name - The room name string.
 * @returns {[number, number]} An array containing the x and y coordinates [x, y].
 */
function roomNameToXY(name) {
  let xx = parseInt(name.substring(1), 10)
  let verticalPos = 2
  // Adjust `verticalPos` based on the length of the x-coordinate part of the room name.
  if (xx >= 100) {
    verticalPos = 4
  } else if (xx >= 10) {
    verticalPos = 3
  }
  let yy = parseInt(name.substring(verticalPos + 1), 10)

  let horizontalDir = name.charAt(0)
  let verticalDir = name.charAt(verticalPos)

  // Adjust coordinates based on 'W' (West) or 'N' (North) prefixes.
  if (horizontalDir === "W" || horizontalDir === "w") {
    xx = -xx - 1
  }
  if (verticalDir === "N" || verticalDir === "n") {
    yy = -yy - 1
  }
  return [xx, yy]
}

module.exports = getObjectStatus
