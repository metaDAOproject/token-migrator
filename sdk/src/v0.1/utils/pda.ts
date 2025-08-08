import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

export const getVaultAddr = (
  programId: PublicKey,
  admin: PublicKey,
  mintFrom: PublicKey,
  mintTo: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("vault"),
      admin.toBuffer(),
      mintFrom.toBuffer(),
      mintTo.toBuffer(),
    ],
    programId,
  );
};

export const getVaultFromAtaAddr = (
  vault: PublicKey,
  mintFrom: PublicKey,
  tokenProgramId: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [vault.toBuffer(), tokenProgramId.toBuffer(), mintFrom.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), // Associated Token Program
  );
};

export const getVaultToAtaAddr = (
  vault: PublicKey,
  mintTo: PublicKey,
  tokenProgramId: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [vault.toBuffer(), tokenProgramId.toBuffer(), mintTo.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  );
};

export const getEventAuthorityAddr = (
  programId: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("__event_authority")],
    programId,
  );
};
