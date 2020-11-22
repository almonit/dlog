pragma solidity >=0.6.10;

import './ENS.sol';
import './FIFSRegistrar.sol';
import './resolver/AlpressResolver.sol';

// SPDX-License-Identifier: GPL
contract Alpress {
    bytes32 constant platform = keccak256(bytes('alpress'));
    bytes32
        public constant TLD_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae; // namehash('eth')
    bytes32 platformNode = keccak256(abi.encodePacked(TLD_NODE, platform)); //TODO hardcode maybe?
    AlpressResolver public resolver; // Custom Alpress resolver
    address private almonit;

    uint256 private rentPricePerYear = 4000000000000000; // price in Wei of renting a blog for one year
    ENS public ens;

    modifier almonit_only {
        require(msg.sender == almonit, 'Access denied');
        _;
    }

    event NewRegistration(bytes32 indexed label, string name);

    event Publication(bytes32 indexed label, bytes contentHash);

    struct Blog {
        string name;
        address payable owner;
        uint256 expirationBlock;
    }

    mapping(address => bytes32) holders;
    mapping(bytes32 => Blog) blogs;

    constructor(ENS _ens, AlpressResolver _resolver) public {
        ens = _ens;
        resolver = _resolver;
        almonit = msg.sender;
    }

    function buy(string calldata name) external payable {
        bytes32 label = keccak256(bytes(name));

        // Blog must not be already registered.
        require(
            ((ens.owner(keccak256(abi.encodePacked(platformNode, label))) ==
                address(0)) || (blogs[label].owner == address(0))),
            'Subdomain is already taken'
        );
        // User must not have more than one account
        require(holders[msg.sender] == 0, "User already has an account");
        // User must have paid enough
        require(msg.value >= rentPricePerYear, 'Not enough amount');

        // Send any extra back
        if (msg.value > rentPricePerYear) {
            msg.sender.transfer(msg.value - rentPricePerYear);
        }

        // Register the domain in ENS
        doRegistration(label);

        // Create blog record
        blogs[label].name = name;
        blogs[label].owner = msg.sender;

        //register for one year "approximately" (assuming accurate block time disregarding leap years)
        blogs[label].expirationBlock = now + 365 days;
        holders[msg.sender] = label;

        emit NewRegistration(label, name);
    }

    function buyAndInitAlpress(string calldata name, bytes calldata contentHash) external payable {
        bytes32 label = keccak256(bytes(name));

        // Blog must not be already registered.
        require(
            ((ens.owner(keccak256(abi.encodePacked(platformNode, label))) ==
                address(0)) || (blogs[label].owner == address(0))),
            'Subdomain is already taken'
        );
        // User must not have more than one account
        require(holders[msg.sender] == 0, "User already has an account");
        // User must have paid enough
        require(msg.value >= rentPricePerYear, 'Not enough amount');

        // Send any extra back
        if (msg.value > rentPricePerYear) {
            msg.sender.transfer(msg.value - rentPricePerYear);
        }

        // Register the domain in ENS
        doRegistration(label);

        // Create blog record
        blogs[label].name = name;
        blogs[label].owner = msg.sender;

        //register for one year "approximately" (assuming accurate block time disregarding leap years)
        blogs[label].expirationBlock = now + 365 days;
        holders[msg.sender] = label;

        bytes32 blogNode = keccak256(abi.encodePacked(platformNode, label));
        resolver.setContenthash(blogNode, contentHash);


        emit NewRegistration(label, name);
        emit Publication(label, contentHash);
    }

    function renew(string calldata name) external payable {
        bytes32 label = keccak256(bytes(name));

        // Blog must be already registered.
        require(
            ((ens.owner(keccak256(abi.encodePacked(platformNode, label))) !=
                address(0)) && (blogs[label].owner != address(0))),
            'Blog is not registered, cannot renew an unregistered blog'
        );

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
            //create for one year "approximately" (assuming accurate block time, disregarding leap years)
            blogs[label].expirationBlock = now + 365 days;
        } else {
            //extend for one year "approximately" (assuming accurate block time, disregarding leap years)
            blogs[label].expirationBlock =
                blogs[label].expirationBlock +
                365 days;
        }
    }

    function unlist(string memory name) public almonit_only {
        bytes32 label = keccak256(bytes(name));

        require(blogs[label].expirationBlock < now, 'Blog is not expired yet');

        // Get the subdomain so we can configure it
        ens.setSubnodeOwner(platformNode, label, address(this));

        bytes32 blogNode = keccak256(abi.encodePacked(platformNode, label));

        // Delete subdomain resolver
        ens.setResolver(blogNode, address(0));

        // Delete subdomain owner, practically it deletes the ENS subdomain
        ens.setOwner(blogNode, address(0));

        // Delete blog from this contract mapping
        delete blogs[label];
        delete holders[msg.sender];
    }

    function doRegistration(bytes32 label) internal {
        // Get the subdomain so we can configure it
        ens.setSubnodeOwner(platformNode, label, address(this));

        bytes32 blogNode = keccak256(abi.encodePacked(platformNode, label));
        // Set the subdomain's resolver
        ens.setResolver(blogNode, address(resolver));
        // Pass ownership of the new subdomain to the registrant
        ens.setOwner(blogNode, msg.sender);
    }

    function publish(string calldata name, bytes calldata contentHash)
        external
    {
        bytes32 label = keccak256(bytes(name));

        require(
            blogs[label].owner == msg.sender,
            'Only owner of the blog can publish'
        );

        require(
            blogs[label].expirationBlock > now,
            'To be able to publish, you need to renew domain'
        );

        bytes32 blogNode = keccak256(abi.encodePacked(platformNode, label));
        
        resolver.setContenthash(blogNode, contentHash);
        emit Publication(label, contentHash);
    }

    /**
     * Functions for adjusting parameters
     **/
    function setPrice(uint256 _rentPricePerYear) public almonit_only {
        rentPricePerYear = _rentPricePerYear;
    }

    function setDefaultResolver(AlpressResolver _resolver) public almonit_only {
        resolver = _resolver;
    }

    /**
     * Query functions
     **/
    function checkTaken(string memory name) public view returns (bool taken) {
        taken = false;

        bytes32 label = keccak256(bytes(name));

        if (
            (blogs[label].owner != address(0)) &&
            (blogs[label].expirationBlock > now)
        ) taken = true;
    }

    function getName() external view returns (string memory name) {
        bytes32 label = holders[msg.sender];
        if(label != 0) {
            return blogs[label].name;
        }
        return "";
    }

    function getOwner(string calldata name)
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

    function getExpiration(string calldata name)
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

    function getPrice() external view returns (uint256 price) {
        price = rentPricePerYear;
    }
}
