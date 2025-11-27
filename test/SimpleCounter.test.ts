// test/SimpleCounter.cofhe.test.ts
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import hre from 'hardhat'
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/node'

describe('SimpleCounter (cofhejs + mocks)', function () {
  async function deployCounterFixture() {
    const [owner, other] = await hre.ethers.getSigners()

    // owner is msg.sender in constructor
    const SimpleCounter = await hre.ethers.getContractFactory('SimpleCounter')
    const counter = await SimpleCounter.connect(owner).deploy(0)

    return { counter, owner, other }
  }

  describe('Functionality', function () {
    beforeEach(function () {
      // Only run these tests when CoFHE MOCK environment is enabled
      if (!hre.cofhe.isPermittedEnvironment('MOCK')) this.skip()

      // Optional: enable detailed logging of FHE ops
      // hre.cofhe.mocks.enableLogs()
    })

    afterEach(function () {
      if (!hre.cofhe.isPermittedEnvironment('MOCK')) return

      // Optional: disable logs
      // hre.cofhe.mocks.disableLogs()
    })

    it('increments counter and checks plaintext via mocks', async function () {
      const { counter, owner } = await loadFixture(deployCounterFixture)

      // Initial encrypted value
      const enc0 = await counter.get_encrypted_counter_value()
      await hre.cofhe.mocks.expectPlaintext(enc0, 0n)

      // increment_counter is onlyOwner, so we use owner
      await hre.cofhe.mocks.withLogs('increment_counter()', async () => {
        await counter.connect(owner).increment_counter()
      })

      const enc1 = await counter.get_encrypted_counter_value()
      await hre.cofhe.mocks.expectPlaintext(enc1, 1n)
    })

    it('uses cofhejs.unseal() to read the counter (no on-chain decrypt)', async function () {
      const { counter, owner } = await loadFixture(deployCounterFixture)

      // Initialize cofhe identity with this signer (owner)
      await hre.cofhe.expectResultSuccess(
        hre.cofhe.initializeWithHardhatSigner(owner)
      )

      // 1) Read initial value via unseal
      const enc0 = await counter.get_encrypted_counter_value()
      const unsealed0 = await cofhejs.unseal(enc0, FheTypes.Uint64)
      await hre.cofhe.expectResultValue(unsealed0, 0n)

      // 2) Increment and unseal again
      await counter.connect(owner).increment_counter()

      const enc1 = await counter.get_encrypted_counter_value()
      const unsealed1 = await cofhejs.unseal(enc1, FheTypes.Uint64)
      await hre.cofhe.expectResultValue(unsealed1, 1n)
    })

    it('cofhejs encrypt -> reset_counter(InEuint64) -> unseal new value', async function () {
      const { counter, owner } = await loadFixture(deployCounterFixture)

      await hre.cofhe.expectResultSuccess(
        hre.cofhe.initializeWithHardhatSigner(owner)
      )

      // Encrypt plaintext 5 as Uint64 using cofhejs
      const [encryptedInput] = await hre.cofhe.expectResultSuccess(
        cofhejs.encrypt([Encryptable.uint64(5n)] as const)
      )

      // Optional: verify mocks see plaintext 5 behind this ctHash
      await hre.cofhe.mocks.expectPlaintext(encryptedInput.ctHash, 5n)

      // Call reset_counter with encrypted input
      await counter.connect(owner).reset_counter(encryptedInput)

      // Read encrypted value back
      const encCount = await counter.get_encrypted_counter_value()

      // Check via mocks
      await hre.cofhe.mocks.expectPlaintext(encCount, 5n)

      // And unseal via cofhejs (this is what a real frontend would do)
      const unsealed = await cofhejs.unseal(encCount, FheTypes.Uint64)
      await hre.cofhe.expectResultValue(unsealed, 5n)
    })
  })
})
