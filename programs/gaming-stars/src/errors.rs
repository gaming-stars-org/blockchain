use anchor_lang::prelude::*;

#[error_code]
pub enum GamingStarsError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Admin already exists")]
    AdminAlreadyExists,
    #[msg("Admin not found")]
    AdminNotFound,
    #[msg("Instance is paused")]
    InstancePaused,
    #[msg("Instance is not active")]
    InstanceNotActive,
    #[msg("Instance is game over")]
    GameOver,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid insurance mint")]
    InvalidInsuranceMint,
    #[msg("Invalid ticket state")]
    InvalidTicketState,
    #[msg("Duplicate settlement")]
    DuplicateSettlement,
    #[msg("Vault mismatch")]
    VaultMismatch,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Invalid beneficiary")]
    InvalidBeneficiary,
    #[msg("Immutable config")]
    ImmutableConfig,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Missing operator cosigner")]
    MissingOperatorCosigner,
    #[msg("Invalid operator cosigner")]
    InvalidOperatorCosigner,
    #[msg("Invalid entry mode")]
    InvalidEntryMode,
    #[msg("Invalid payer authority")]
    InvalidPayerAuthority,
    #[msg("Sponsored entries cannot be insured")]
    SponsoredInsuranceNotAllowed,
    #[msg("Maximum insured tickets reached")]
    MaxInsuredTicketsReached,
    #[msg("Active ticket already exists for user in this game")]
    ActiveTicketExists,
    #[msg("Ticket is not insured")]
    TicketNotInsured,
    #[msg("Instance is not in GameOver state")]
    InstanceNotOver,
    #[msg("Treasury vault is not empty")]
    TreasuryVaultNotEmpty,
    #[msg("Vault does not belong to this instance")]
    InvalidTreasuryVault,
}
