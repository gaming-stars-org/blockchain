# On-Chain Contract: Instruction Contract

## Privileged Instructions

- `initialize_factory(owner, dev_wallet, master_wallet, operator_wallet)`
  - Signer: owner
- `add_admin(admin_wallet)`
  - Signer: owner
- `remove_admin(admin_wallet)`
  - Signer: owner
- `update_global_wallets(new_dev_wallet?, new_master_wallet?, new_operator_wallet?)`
  - Signer: owner
- `deploy_instance(instance_id, ticket_price, entry_fee, insurance_premium, payout_ratio_num, payout_ratio_den, game_duration_secs, user_ttl_secs, accepted_mints)`
  - Signer: owner or admin
- `freeze_instance(instance_id)`
  - Signer: owner or admin
- `unfreeze_instance(instance_id)`
  - Signer: owner or admin
- `topup_global_liquidity(mint, amount)`
  - Signer: master_wallet
- `set_game_over(instance_id)`
  - Signer: operator_wallet

## Entry Instruction

- `buy_ticket(instance_id, entry_mode, entry_mint, insured, entry_total_amount, insurance_premium_amount, external_ref?)`
  - Signers: user + operator_wallet
  - Critical validation:
    - operator signer matches `FactoryState.operator_wallet`
    - entry amount exactness
    - entry-mode payer authority mapping
    - sponsored cannot be insured
    - entry mint accepted by instance
    - insured entries require insurance mint in supported set (`USDT`, `USDC`)

## Settlement Instructions

- `settle_payout(settlement_id, instance_id, ticket_id, beneficiary, legs, resolution_kind)`
- `settle_refund(settlement_id, instance_id, ticket_id, beneficiary, refund_mint, amount)`
- `settle_forfeit(settlement_id, instance_id, ticket_id, legs, resolution_kind)`
- `settle_users_batch(instance_id, items)`

All settlement paths require:

- signer is operator_wallet
- ticket status is active
- receipt PDA does not exist for settlement ID
- beneficiary ownership checks for payout/refund
- vault derivation checks for all transfer legs
- refund source must be the global liquidity vault for `refund_mint` (`USDT` or `USDC`)

## Error Codes

- `Unauthorized`
- `AdminAlreadyExists`
- `AdminNotFound`
- `InstancePaused`
- `InstanceNotActive`
- `GameOver`
- `InvalidMint`
- `InvalidAmount`
- `InvalidInsuranceMint`
- `InvalidTicketState`
- `DuplicateSettlement`
- `VaultMismatch`
- `InsufficientVaultBalance`
- `InvalidBeneficiary`
- `ImmutableConfig`
- `ArithmeticOverflow`
- `MissingOperatorCosigner`
- `InvalidOperatorCosigner`
- `InvalidEntryMode`
- `InvalidPayerAuthority`
- `SponsoredInsuranceNotAllowed`
