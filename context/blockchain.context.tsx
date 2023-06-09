import React, { PropsWithChildren, useCallback, useContext, useEffect, useState } from "react";
import { VenomConnect } from 'venom-connect';
import { initVenomConnect } from '../utils/venom-connect';
import { ProviderRpcClient } from 'everscale-inpage-provider';
import {useDispatch, useSelector} from "react-redux";
import { useUserNetwork } from '../model/user/api';
import {setAccount, setAccountStart} from "../model/user/reducer";



interface BlockchainContextValue {
  venomAddress: string | undefined;
  connected: boolean;
  setConnected: React.Dispatch<React.SetStateAction<boolean>>;
  openAddWallet: boolean;
  setOpenAddWallet: React.Dispatch<React.SetStateAction<boolean>>,
	venomProvider: ProviderRpcClient | undefined;
	standaloneProvider: ProviderRpcClient | undefined;
  connectToVenom: () => void;
}

const BlockchainContext = React.createContext<BlockchainContextValue>({
  venomAddress: '',
	venomProvider: undefined,
	standaloneProvider: undefined,
  connected: false,
  setConnected: () => {void 0},
  openAddWallet: false,
  setOpenAddWallet: () => {void 0},
  connectToVenom: () => {void 0},
})

export const BlockchainProvider: React.FC = (props: PropsWithChildren<unknown>) => {

  const isNewAccount = useSelector(state => state.user.isNewAccount)
	const { getUserByAccountId, userCreate } = useUserNetwork()
  const [venomConnect, setVenomConnect] = useState<VenomConnect | undefined>()
	const [venomProvider, setVenomProvider] = useState<ProviderRpcClient | undefined>()
	const [standaloneProvider, setStandaloneProvider] = useState<ProviderRpcClient | undefined>()
	const [venomAddress, setVenomAddress] = useState<string | undefined>()
  const [connected, setConnected] = useState(false);
  const [openAddWallet, setOpenAddWallet] = useState(false);

  	const dispatch = useDispatch()
  
	useEffect(() => {
		if(venomAddress) {
			dispatch({
				payload: {
					account: venomAddress,
					onSuccess: setAccount.type
				},
				type: setAccountStart.type
			})
			setConnected(true);
      setOpenAddWallet(false);
		}
	}, [ dispatch, venomAddress, setConnected, setOpenAddWallet])

	useEffect(()=>{
		if (venomAddress) {
			getUserByAccountId(venomAddress)
		}
	},[account, venomAddress])

	useEffect(()=>{

		if (isNewAccount && venomAddress) {
			userCreate(venomAddress)
			setTimeout(()=>{getUserByAccountId(venomAddress)},100)
		}
	},[isNewAccount])

  const getVenomAddress = async (provider: any) => {
		const providerState = await provider?.getProviderState?.();
		return providerState?.permissions.accountInteraction?.address.toString()
	}

	const checkAuth = async (_venomConnect: any) => {
		const auth = await _venomConnect?.checkAuth();
		if (auth) await getVenomAddress(_venomConnect)
	}

	const initStandalone = async () => {
		const standalone = await venomConnect?.getStandalone();
		setStandaloneProvider(standalone)
	}

	const onVenomConnect = async (provider: any) => {
		setVenomProvider(provider)
		await onProviderReady(provider)
	}

	const onProviderReady = async (provider: any) => {
		const venomWalletAddress = provider ? await getVenomAddress(provider) : undefined;
		setVenomAddress(venomWalletAddress)
	}

	useEffect(() => {
		if (venomConnect) {
			venomConnect.connect()
		}

		const off = venomConnect?.on('connect', onVenomConnect);
		if (venomConnect) {
			initStandalone();
			checkAuth(venomConnect)
		}

		return () => {
			off?.();
		}
	}, [venomConnect])


	const connectToVenom = async () => {
		const _venomConnect = await initVenomConnect();
		setVenomConnect(_venomConnect)
	}


  return (
    <BlockchainContext.Provider
      value={{
        venomAddress,
				venomProvider,
				standaloneProvider,
        openAddWallet,
        setOpenAddWallet,
        connected,
        setConnected,
        connectToVenom
      }}
    >
      {props.children}
    </BlockchainContext.Provider>
  )
}

export const useBlockchain = (): BlockchainContextValue => useContext(BlockchainContext);

