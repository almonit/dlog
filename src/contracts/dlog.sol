pragma solidity >=0.6.10;

import './FIFSRegistrar.sol';
import './Resolver.sol';

// SPDX-License-Identifier: GPL
contract Alpress {
    string constant platform = 'alpress';
    bytes32 public constant TLD_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae; // namehash('eth')
    address resolver = 0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41; // ENS standard resolver
    address almonit;
    //address almonit = 0xC741cdDa197Af87Acd54a4A5f563C8efDbc754B7; // Almonit multisig account

    modifier almonit_only {
        if (msg.sender != almonit) revert('Access denied');
        _;
    }

    event NewRegistration(bytes32 indexed label, string name);

    struct Blog {
        string name;
        address payable owner;
        uint256 expirationBlock;
    }

    mapping(bytes32 => Blog) blogs;

    uint256 rentPricePerYear = 4500000000000000; // price in Wei of renting a blog for one year
    ENS public ens;
    Resolver public publicResolver;

    constructor(ENS _ens, Resolver _publicResolver, address _owner) public {
        ens = _ens;
        publicResolver = _publicResolver;
        almonit = _owner;
    }

    function buy(string calldata name) external payable {
        bytes32 platformNode = keccak256(abi.encodePacked(TLD_NODE, platform));
        bytes32 label = keccak256(bytes(name));

        // Blog must not be registered already.
        require(
            ens.owner(keccak256(abi.encodePacked(platformNode, label))) ==
                address(0),
            'User already registered'
        );

        // User must have paid enough
        require(msg.value >= rentPricePerYear, 'Not enough amount');

        // Send any extra back
        if (msg.value > rentPricePerYear) {
            msg.sender.transfer(msg.value - rentPricePerYear);
        }

        // Register the domain in ENS
        doRegistration(platformNode, label, msg.sender);

        // Create blog record
        Blog storage blog = blogs[label];
        blog.name = name;
        blog.owner = msg.sender;

        //register for one year "approximately" (assuming accurate block time disregarding leap years)
        blog.expirationBlock = now + 365 days;

        emit NewRegistration(label, name);
    }

    function renew(string calldata name) external payable {
        bytes32 label = keccak256(bytes(name));

        // User must have paid enough
        require(
            msg.value >= rentPricePerYear,
            'The given amount is not enough to renew'
        );

        // Send any extra back
        if (msg.value > rentPricePerYear) {
            msg.sender.transfer(msg.value - rentPricePerYear);
        }

        if (blogs[label].expirationBlock < now) {
            //extend for one year "approximately" (assuming accurate block time, disregarding leap years)
            blogs[label].expirationBlock = blogs[label].expirationBlock + 365 days;
        }
    }

    function unlist(string memory name) public almonit_only {
        bytes32 label = keccak256(bytes(name));

        Blog storage blog = blogs[label];
        if (blog.expirationBlock < now) {
            bytes32 platformNode = keccak256(
                abi.encodePacked(TLD_NODE, platform)
            );
            // Get the subdomain so we can configure it
            ens.setSubnodeOwner(platformNode, label, address(this));

            bytes32 blogNode = keccak256(abi.encodePacked(platform, label));
            // Set the subdomain's resolver
            ens.setResolver(blogNode, address(0));

            // Set the address record on the resolver
            publicResolver.setAddr(blogNode, address(0));

            // Pass ownership of the new subdomain to the registrant
            ens.setOwner(blogNode, address(0));
        }
    }

    function doRegistration(bytes32 platformNode, bytes32 label, address subOwner) internal {
        // Get the subdomain so we can configure it
        ens.setSubnodeOwner(platformNode, label, address(this));

        bytes32 blogNode = keccak256(abi.encodePacked(platformNode, label));
        // Set the subdomain's resolver
        ens.setResolver(blogNode, resolver);

        // Set the address record on the resolver
        publicResolver.setAddr(blogNode, address(0));

        // Pass ownership of the new subdomain to the registrant
        ens.setOwner(blogNode, subOwner);
    }

    /**
     * Functions for adjusting parameters
     **/
    function setPrice(uint256 price) public almonit_only {
        // Only Almonit can change price
        rentPricePerYear = price;
    }

    function setDefaultResolver(address newResolver) public almonit_only {
        // Only Almonit can change default resolver
        resolver = newResolver;
    }

    /**
     * Query functions
     **/
    function checkTaken(string memory name) public view returns (bool taken) {
        taken = false;

        bytes32 label = keccak256(bytes(name));

        if (
            (blogs[label].owner != address(0)) &&
            (blogs[label].expirationBlock < now)
        ) taken = true;
    }

    function checkOwner(string calldata name)
        external
        view
        returns (address owner)
    {
        // if no owner return empty address
        owner = address(0);

        if (checkTaken(name)) {
            bytes32 label = keccak256(bytes(name));
            owner = blogs[label].owner;
        }
    }

    function checkExpiration(string calldata name)
        external
        view
        returns (uint256 expirationTime)
    {
        // if unregistered return 0
        expirationTime = 0;

        if (checkTaken(name)) {
            bytes32 label = keccak256(bytes(name));
            expirationTime = blogs[label].expirationBlock;
        }
    }
}
