// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title ICMATypes
/// @notice ICMA Bond Data Taxonomy v1.2 data structures for fixed income securities.
/// @dev Used by BondMetadataRegistry to store bond metadata on-chain.
library ICMATypes {

    /// @notice Core bond identification and static terms (ICMA BDT v1.2 Section: Bond Static Data).
    struct BondStaticData {
        string isin;                      // ISIN code (ISO 6166)
        string issuerLei;                 // Legal Entity Identifier (ISO 17442)
        string issuerName;                // Issuer legal name
        string issuanceType;              // "Government", "Corporate", "Sukuk"
        string currency;                  // Denomination currency (ISO 4217)
        string paymentCurrency;           // Payment currency (ISO 4217)
        string settlementCurrency;        // Settlement currency (ISO 4217)
        uint256 denomination;             // Minimum denomination (face value per unit)
        uint256 integralMultiples;        // Trading increment above denomination
        uint256 calculationAmount;        // Amount used for interest calculations
        string pricingDate;               // ISO 8601
        string issuanceDate;              // ISO 8601
        string settlementDate;            // First settlement date (ISO 8601)
        uint256 issuePrice;               // Issue price in bps (10000 = 100%)
        string methodOfDistribution;      // "Auction", "Syndicated", "Private Placement"
        string governingLaw;              // Applicable law jurisdiction
        string formOfNote;                // "Registered", "Bearer", "Digital"
        string statusOfNote;              // "Senior", "Subordinated"
        uint256 aggregateNominalAmount;   // Total issuance amount
        string maturityDate;              // ISO 8601
        bool dltBondIndicator;            // true if DLT-native
        string listingMarket;             // Exchange or market
        string listingMarketType;         // "Regulated", "MTF"
        string clearingSettlementSystem;  // "BI-SSSS", "KSEI", "On-chain"
        string sellingRestrictions;       // Jurisdictional restrictions
        string manufacturerTargetMarket;   // MiFID II target market
        bool flagNegativePledge;          // Negative pledge covenant
        bool flagGrossUp;                 // Gross-up provision
        bool flagCrossDefault;            // Cross-default clause
    }

    /// @notice Interest and return terms (ICMA BDT v1.2 Section: Interest/Return Terms).
    struct BondTerms {
        string interestType;              // "Fixed", "Floating", "Zero",
                                          // "Syariah_Ijarah", "Syariah_Mudharabah", "Syariah_Wakalah"
        uint256 interestRateBps;          // Rate in basis points (500 = 5.00%)
        string paymentFrequency;          // "Annual", "SemiAnnual", "Quarterly", "Monthly", "AtMaturity"
        string dayCountFraction;          // "ACT/360", "ACT/365", "30/360", "ACT/ACT"
        string businessDayConvention;     // "Following", "Modified Following", "Preceding"
        string businessDayCenter;         // "Jakarta", "London", "New York"
        uint8 interestPaymentDay;         // Day of month for coupon payments (1-31)
        uint8 interestPaymentMonth;       // Month of first payment in cycle (1-12)
        string firstPaymentDate;          // ISO 8601
        string lastPaymentDate;           // ISO 8601
        string interestCommencementDate;  // ISO 8601
        uint256 finalRedemptionPct;       // Final redemption price in bps (10000 = 100%)
        uint256 earlyRedemptionPct;       // Early redemption price in bps (10000 = 100%)
    }

    /// @notice DLT-specific platform information (ICMA BDT v1.2 Section: DLT Platform Data).
    struct DltPlatformData {
        string platformType;              // "Ethereum", "Hyperledger", "Permissioned"
        string accessibility;             // "Public", "Private", "Consortium"
        string role;                      // "Issuer", "Registrar", "Paying Agent"
        string operatorName;              // "Bank Indonesia"
        string platformName;               // "CBDC Sandbox"
        string tokenType;                  // "ERC1400"
        string smartContract;              // Contract address as string
    }

    /// @notice Credit and default events (ICMA BDT v1.2 Section: Credit Events).
    struct CreditEvents {
        bool flagDefault;                 // Has a default event occurred
        bool flagRedeemed;                // Has the bond been fully redeemed
        string rating;                    // Current credit rating
        string ratingAgency;              // Rating agency name
    }

    /// @notice Bond ratings from rating agencies.
    struct BondRatings {
        string ratingAgency;              // "Fitch", "Moody's", "S&P", "Pefindo"
        string expectedProductRating;     // Expected bond rating
        string partyRating;               // Issuer entity rating
    }

    /// @notice Indonesian market extensions (beyond ICMA BDT v1.2).
    struct IndonesianMarketData {
        string productCode;               // "SRBI", "SBN", "SBSN", "SPN"
        string seriesCode;                // "SRBI-001", "FR0098", "PBS038"
        string regulatoryFramework;       // "UU No. 24/2002", "UU No. 19/2008"
        string shariaComplianceBoard;     // DSN-MUI fatwa reference
        string underlyingAsset;           // For Sukuk: description of underlying asset
        uint256 tenorDays;                // Tenor in calendar days
        string auctionMechanism;          // "Variable Rate", "Fixed Rate", "Multiple Price"
    }
}