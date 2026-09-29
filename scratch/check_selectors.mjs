import { toFunctionSelector } from 'viem'

console.log('old createRoom:', toFunctionSelector('createRoom(bytes32,uint256,uint256,uint8)'))
console.log('new createRoom:', toFunctionSelector('createRoom(bytes32,uint256,uint256,uint8,uint8,uint16[],bytes32)'))
