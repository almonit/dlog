import { AbstractProvider } from 'web3-core/types';

export function timeTravel(
  web3: { currentProvider: AbstractProvider },
  time: number
): Promise<void> {
  return new Promise(resolve => {
    web3.currentProvider.sendAsync(
      {
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [time],
        id: new Date().getTime()
      },
      error => {
        if (error) throw error;
        resolve();
      }
    );
  });
}
