// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


import {FHE, euint64, InEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract SimpleCounter {
    address owner; 

    euint64 counter; 
    euint64 delta; 
    euint64 lastDecryptedCounter; 

    modifier onlyOwner() {
        require(msg.sender== owner, "Only owner can access"); 
        _; 
    }

    constructor(uint64 initial_value){
        owner = msg.sender; 
        counter = FHE.asEuint64(initial_value); 
        FHE.allowThis(counter); 
        FHE.allow(counter, owner);  // allow owner

        //Encrypt the value 1 only once instead of every value change 
        delta = FHE.asEuint64(1); 
        FHE.allowThis(delta); 

    }

    function increment_counter() external onlyOwner {
        counter = FHE.add(counter, delta) ;
        FHE.allowThis(counter); 
        FHE.allowSender(counter); // allow owner

    }

    function decrement_counter() external onlyOwner{
        counter = FHE.sub(counter, delta); 
        FHE.allowThis(counter); 

    } 

    function reset_counter(InEuint64 calldata value) external onlyOwner {
        counter = FHE.asEuint64(value); 
        FHE.allowThis(counter); 
        FHE.allowSender(counter);         // 👈 owner can unseal reset value


    }

    function decrypt_counter() external onlyOwner {
        lastDecryptedCounter = counter; 
        FHE.decrypt(lastDecryptedCounter); 
    }

    function get_counter_value() external view returns(uint256){
        (uint256 value, bool decrypted) = FHE.getDecryptResultSafe(lastDecryptedCounter); 
        if (!decrypted) {
            revert("Value not ready"); 
        }
        
        return value; 
    }

    function get_encrypted_counter_value() external view returns(euint64){
        return counter; 
    }


} 