pragma solidity >=0.6.10;
pragma experimental ABIEncoderV2;

import '../ENS.sol';
import './ABIResolver.sol';
import './AddrResolver.sol';
import './ContentHashResolver.sol';
import './DNSResolver.sol';
import './InterfaceResolver.sol';
import './NameResolver.sol';
import './PubkeyResolver.sol';
import './TextResolver.sol';

/**
 * A simple resolver anyone can use; only allows the owner of a node to set its
 * address.
 */
contract AlpressResolver is
    ABIResolver,
    AddrResolver,
    ContentHashResolver,
    DNSResolver,
    InterfaceResolver,
    NameResolver,
    PubkeyResolver,
    TextResolver
{
    ENS ens;
    address alpress;

    /**
     * A mapping of authorisations. An address that is authorised for a name
     * may make any changes to the name that the owner could, but may not update
     * the set of authorisations.
     * (node, owner, caller) => isAuthorised
     */
    mapping(bytes32 => mapping(address => mapping(address => bool)))
        public authorisations;

    event AuthorisationChanged(
        bytes32 indexed node,
        address indexed owner,
        address indexed target,
        bool isAuthorised
    );

    constructor(ENS _ens, address _alpress) public {
        ens = _ens;
        alpress = _alpress;
    }

    /**
     * Authorisations are specific to the caller. Any account can set an authorisation
     * for any name, but the authorisation that is checked will be that of the
     * current owner of a name. Thus, transferring a name effectively clears any
     * existing authorisations, and new authorisations can be set in advance of
     * an ownership transfer if desired.
     *
     */
    function setAlpress(address _alpress) external {
        if (msg.sender == alpress) alpress = _alpress;
    }

    function isAuthorised(bytes32 node) internal override view returns (bool) {
        return msg.sender == alpress;
    }

    function multicall(bytes[] calldata data)
        external
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(
                data[i]
            );
            require(success, 'nope');
            results[i] = result;
        }
        return results;
    }

    function supportsInterface(bytes4 interfaceID)
        public
        override(
            ABIResolver,
            AddrResolver,
            ContentHashResolver,
            DNSResolver,
            InterfaceResolver,
            NameResolver,
            PubkeyResolver,
            TextResolver
        )
        pure
        returns (bool)
    {
        return super.supportsInterface(interfaceID);
    }
}
