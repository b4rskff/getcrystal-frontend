import {Upload, AutoComplete, Switch, Input, Select, DatePicker, TimePicker, Button} from 'antd';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import { nanoid } from 'nanoid';
import NftBuyNow from '../nftBuyNow';
import styles from './styles.module.scss';
import cx from 'classnames';
import Footer from '../footer';

import Web3 from "web3";
import {UploadChangeParam} from "antd/es/upload";
import {UploadFile} from "antd/es/upload/interface";
import axios from "axios";
import {useSelector} from "react-redux";
import contractABI from '../../constants/contract.json'
import collectionContractABI from '../../constants/singlecrystal.json'
import Contract from 'web3-eth-contract'
import {useHistory, useParams} from "react-router-dom";
import {string} from "yup";
import {useNftNetwork} from "../../model/nft/api";
import {Nft} from "../../model/nft/reducer";
import { showNoty } from '../../hooks/showNoty';
import { envBaseUrl } from '../../model/saga';
import paths from '../paths';
import { RenderImage } from '../nft/renderNft';
import Preloader from '../../components/preloader';
import { useBlockchain } from '../../context/blockchain.context';
import VenomCollectionContractABI from '../../constants/venom/Collection.abi.json'
import { Address } from 'everscale-inpage-provider';
import BigNumber from 'bignumber.js';

type MainPageProps = {
	width: number
}

type ParametersState = {
	id: string;
	parameter: string,
	unit: string,
	value: string,
}

export const getBase64 = (file: Blob, cb: (arg0: string | ArrayBuffer | null) => void, filesCount : number) => {
	if (filesCount) {
		let reader = new FileReader();
		reader.onload = function () {
			cb(reader.result)
		};
		//@ts-ignore
		reader.readAsDataURL(file.originFileObj);
		reader.onerror = function (error) {
			console.log('Error: ', error);
		};
	} else cb('')
}
const getBufferFile = (file: any, cb: (arg0: string | ArrayBuffer | null) => void, filesCount : number) => {
	if (filesCount) {
		cb(file.file.originFileObj)
	} else cb(null)
}


const getParameterItem = () => ({
	id: nanoid(6),
	parameter: '',
	unit: '',
	value: '',
});

const availiableTypes = [
	"image/png",
	"image/gif",
	"image/webp",
	"video/mp4",
	"video/mp3"
]

const CreateNFT: React.FC<MainPageProps> = ({ width }) => {
	const { TextArea } = Input;
	const { Option } = Select;
	const { Dragger } = Upload;
	const history = useHistory()
	const params = useParams();
	const contract = useSelector(state => state.user.contract);
	const account = useSelector(state => state.user.account);
	const myAccount = useSelector(state => state.user.profile);
	const collection = useSelector(state => state.nft.collection);
	const nftParamsAutocomplete = useSelector(state => state.nft.nftParamsOptions);
	const nftUnitsAutocomplete = useSelector(state => state.nft.nftUnitsOptions);
	const [title, setTitle] = useState('');
	const [date, setDate] = useState(null);
	const [description, setDescription] = useState('');
	const [putOnMarket, setPutOnMarket] = useState(false);
	const [lazyMint, setLazyMint] = useState(false);
	const [isCreateOnCollection, setIsCreateOnCollection] = useState(false);
	const [type, setType] = useState('');
	const [imageNft, setImageNft] = useState<string | undefined>('')
	const [blobNft, setBlobNft] = useState<any | null>(null)
	const [isCreateFetching, setIsCreateFetching] = useState<boolean>(false)
	const [tags, setTags] = useState<{tokenId: string, tag: string}[]>([])
	const [parameters, setParameters] = useState<ParametersState[]>([getParameterItem()])
	const web3 = new Web3(Web3.givenProvider);
	const { venomAddress, standaloneProvider, venomProvider } = useBlockchain()
	const {collectionGetByUrl, nftParamsOptions, nftUnitsOptions} = useNftNetwork();
	const handleChange = useCallback((value: Array<string>) => {
		const tags = value.map(el => {
			return {
				tokenId: '',
				tag: el
			}
		})
		setTags(tags)
	}, []);
	const paramsAddHandler = () => setParameters(
		(prevState) => [...prevState, getParameterItem()]
	);
	const paramsEditHandler = (id: string, field: 'parameter' | 'unit' | 'value', value: string) => setParameters(
		(prevState) => prevState.map((it) => it.id === id
			? ({ ...it, [field]: value })
			: it));
	const paramsRemoveHandler = (id: string) => setParameters((prevState) => prevState
		.filter((it) => it.id !== id));

	console.log('tags',tags)

/*	useEffect(() => {
		nftParamsOptions();
	}, []);*/

	useEffect(()=>{
		// @ts-ignore
		if (params?.collection) {
			// @ts-ignore
			collectionGetByUrl(params.collection)
			nftParamsOptions()
			nftUnitsOptions()
		} 
	},[params])

	useEffect(()=>{
		// @ts-ignore
		if (params?.collection && collection?.url === params?.collection) {
			setIsCreateOnCollection(true)
			if (myAccount?.username && (myAccount?.account_id !== collection?.author)) {
				showNoty('error','Error! You do not have sufficient permissions to create NFTs in this collection', 3)
				history.push('/');
			}
		} else {
			setIsCreateOnCollection(false)
		}
	},[params, collection, myAccount])



	async function createItem() {
		setIsCreateFetching(true);
		if (!imageNft && !blobNft) {
			setIsCreateFetching(false);
			return;
		}

		// @ts-ignore
		const url = `${envBaseUrl}/api/ipfs/save`;

		const data = new FormData();
		data.append('nft',blobNft, blobNft?.name);
		data.append('name',title);
		data.append('description',description);
		data.append('tags',JSON.stringify(tags?.map(el => el?.tag)));
		data.append('params', JSON.stringify(parameters.filter((it) => it.parameter.length)));

		if (isCreateOnCollection) {
			data.append('collectionName',collection?.name)
		}
		
		//making axios POST request to Pinata ⬇️
		return axios
			.post(url, data, {
				headers: {
					'Content-Type': 'multipart/form-data', 
				},
			})
			.then(async function (response) {
				let metadata = response.data.res;
				console.log('metadata', metadata)
				

				if (venomAddress) {

					if (venomProvider) {

						const imgData = await axios.get(`${process?.env?.REACT_APP_PINATA_IPFS_GATEWAY}/${metadata}`)

	
						const Mycontract = new venomProvider.Contract(VenomCollectionContractABI, new Address(process?.env?.REACT_APP_VENOM_COLLECTION))

						const amount = new BigNumber(1).shiftedBy(9).toFixed(0)

						//@ts-ignore
						const Mydata = await Mycontract.methods.mintNft({json: JSON.stringify({
							//@ts-ignore
							type: "Basic NFT",
							name: title,
							description: description,
							preview: {
								source: `${process?.env?.REACT_APP_PINATA_IPFS_GATEWAY}/${imgData.data.ipfs_hash}`,
								mimetype: "image/png"
							},
							files: [
								{
									source: `${process?.env?.REACT_APP_PINATA_IPFS_GATEWAY}/${imgData.data.ipfs_hash}`,
									mimetype: "image/png"
								}
							],
							external_url: `${process?.env?.REACT_APP_PINATA_IPFS_GATEWAY}/${metadata}`
						})}).send( {from: new Address(venomAddress), amount});
						
						showNoty('success','NFT has been created successfully and will appear in a minute')
						setIsCreateFetching(false);
						// add processing
					}
					
				} else {
					let abi = isCreateOnCollection ? collectionContractABI.abi : contractABI.abi
					let contractData = isCreateOnCollection ? collection.contract : contract
					// @ts-ignore
					const Mycontract = await new Contract(abi, contractData);
				const Mydata = Mycontract.methods
					//@ts-ignore
					.safeMint(window.ethereum.selectedAddress, metadata)
					.encodeABI();
				web3.eth
					.sendTransaction({
						//@ts-ignore
						from: window.ethereum.selectedAddress,
						to: contractData,
						data: Mydata,
					}, (err, hash) => {
						if (!err) {
							const tpUrl = `${envBaseUrl}/api/processing/add`;

							const tpData = new FormData();
							tpData.append('hash', hash);
							tpData.append('userId', String(myAccount.id));
							tpData.append('sessionId', sessionStorage.getItem('sessionId') || '');
							tpData.append('event', 'mint');
	
							axios.post(tpUrl, tpData, {
								headers: {
									'Content-Type': 'multipart/form-data', 
								},
							})
						} else {
							showNoty('error');
							setIsCreateFetching(false);
						}
					})
					.then((res) => {
						let id = web3.utils.hexToNumber(res.logs[0].topics[3]);
						console.log('res',res)
						showNoty('success','NFT has been created successfully and will appear in a minute')
						const notificationData = new FormData();
						notificationData.append('hash',res.transactionHash);

						axios.post(`${envBaseUrl}/api/processing/setNotified`, notificationData, {
							headers: {
								'Content-Type': 'multipart/form-data', 
							}
						});
						history.push('/')
						if (isCreateOnCollection) {
							
						}
						setIsCreateFetching(false);
					})
					.then((err) => {
						console.log(err);
						setIsCreateFetching(false);
					})
					.catch(function (error) {
						console.log('Error: ',error)
						showNoty('error');
						setIsCreateFetching(false);
					});
				}
			})
			.catch(function (error) {
				setIsCreateFetching(false);
				showNoty('error', 'Something is wrong. Please contact support')
				return {
					success: false,
					message: console.log(error.message),
				};
			});
	}

	const beforeUpload = (file: File, fileList: File[]) => {
		if (file.size > 100000000) {
			showNoty('error', 'The maximum file size is 100 MB');
			return Upload.LIST_IGNORE;
		}
		if (!availiableTypes.includes(file.type.toLowerCase())) {
			showNoty('error', 'We are support only PNG, GIF, WEBP, MP3/MP4 files');
			return Upload.LIST_IGNORE;
		}
		return (file.type.includes('avif')) ? Upload.LIST_IGNORE : true
	}

	return (
		<>
		<Preloader 
			active={isCreateFetching}
			text='Do not update the page until the end of transaction. Otherwise, the changes will not appear on the marketplace. Fixing the transaction will take quite a long time.'
		/>
		<div className={styles.container}>
			<p className={styles.title}>Create your NFT</p>
			{/* @ts-ignore */}
			{isCreateOnCollection && !!params?.collection &&
				<p className={styles.collectionInfo}>Collection: 
				{/* @ts-ignore */}
				<span className={styles.collectionInfoName} onClick={()=>{history.push(`${paths.collection}/${collection.url}`)}}>{collection.name}</span></p>}
			<div className={styles.rowMain}>
				<div className={styles.leftContainer}>
					<div className={styles.column}>
						<p className={styles.label}>Upload</p>
						<Dragger
							accept={'image/PNG, image/GIF, image/WEBP, video/mp4'}
							customRequest={() => {}}
							onChange={(file) => {
								// @ts-ignore
								getBase64(file.file, setImageNft, file.fileList.length)
								// @ts-ignore
								getBufferFile(file, setBlobNft, file.fileList.length)
							}}
							maxCount={1}
							beforeUpload={beforeUpload}
						>
							<p className={styles.uploadText}>PNG, GIF, WEBP, MP4/MP3</p>
							<p className={styles.uploadText}>max 100 mb</p>
							<p className={styles.chooseFileBtn}>Choose file</p>
						</Dragger>
					</div>
					<div className={styles.column}>
						<p className={styles.label}>Name</p>
						<Input placeholder='Item name' value={title} onChange={(e) => setTitle(e.target.value)}/>
					</div>
					<div className={styles.column}>
						<p className={styles.label}>Description</p>
						<TextArea placeholder='Write a short descriprion of your item to reveal its true essence '  onChange={(e) => setDescription(e.target.value)}/>
					</div>
					<div className={styles.column}>
						<p className={styles.label}>Tags</p>
						<Select
							className={styles.tagsSelect}
							mode="tags"
							allowClear
							style={{ width: '100%' }}
							placeholder="Please select"
							// defaultValue={['a10', 'c12']}
							onChange={handleChange}
							tokenSeparators={[',']}
							dropdownClassName={styles.selectDropdown}
						>
						</Select>
					</div>
					{isCreateOnCollection && (
						<div className={styles.column}>
							<p className={styles.label}>Parameters</p>
							<div className={styles.parametersTable}>
								<div className={styles.parametersTableHeader}>
									<div className={cx(styles.parametersTitle, styles.cell, styles.headerCell)}>Parameter</div>
									<div className={cx(styles.parametersUnit, styles.cell, styles.headerCell)}>Unit</div>
									<div className={cx(styles.parametersValue, styles.cell, styles.headerCell)}>Value</div>
									<div />
								</div>
								{parameters.map((it) => (
									<div className={styles.rowWrapper}>
										<div className={cx(styles.parametersTitle, styles.cell, styles.cellWithAutocomplete)}>
											<AutoComplete
												className={styles.createNftParams}
												dropdownStyle={{ backgroundColor: '#333333', }}
												dropdownClassName={styles.createNftParamsDropdown}
												size="small"
												inputValue={it.parameter}
												filterOption
												onChange={(str) => paramsEditHandler(it.id, 'parameter', str)}
											>
												{nftParamsAutocomplete.map((it, i) => (
													<Select.Option key={`${it}-${i}`} className={styles.createNftParamsDropdown} value={it}>
														{it}
													</Select.Option>
												))}
											</AutoComplete>
										</div>
										<div className={cx(styles.parametersUnit, styles.cell, styles.cellWithAutocomplete)}>
											<AutoComplete
												className={styles.createNftParams}
												dropdownStyle={{ backgroundColor: '#333333', }}
												dropdownClassName={styles.createNftParamsDropdown}
												size="small"
												inputValue={it.unit}
												filterOption
												onChange={(str) => paramsEditHandler(it.id, 'unit', str)}
											>
												{nftUnitsAutocomplete.map((it, i) => (
													<Select.Option key={`${it}-${i}`} className={styles.createNftParamsDropdown} value={it}>
														{it}
													</Select.Option>
												))}
											</AutoComplete>
										</div>
										<div className={cx(styles.parametersValue, styles.cell, styles.cellWithAutocomplete)}>
											<AutoComplete
												className={styles.createNftParams}
												dropdownStyle={{ backgroundColor: '#333333', }}
												dropdownClassName={styles.createNftParamsDropdown}
												size="small"
												inputValue={it.value}
												onChange={(str) => paramsEditHandler(it.id, 'value', str)}
											/>
										</div>
										<div className={styles.cellRemove}>
											<button className={styles.parametersTableRemove} onClick={() => paramsRemoveHandler(it.id)}>
												<svg width="30" height="31" viewBox="0 0 30 31" fill="none" xmlns="http://www.w3.org/2000/svg">
													<path d="M12 5.25H18C18 4.45435 17.6839 3.69129 17.1213 3.12868C16.5587 2.56607 15.7956 2.25 15 2.25C14.2044 2.25 13.4413 2.56607 12.8787 3.12868C12.3161 3.69129 12 4.45435 12 5.25ZM9.75 5.25C9.75 4.56056 9.88579 3.87787 10.1496 3.24091C10.4135 2.60395 10.8002 2.0252 11.2877 1.53769C11.7752 1.05018 12.354 0.66347 12.9909 0.399633C13.6279 0.135795 14.3106 0 15 0C15.6894 0 16.3721 0.135795 17.0091 0.399633C17.646 0.66347 18.2248 1.05018 18.7123 1.53769C19.1998 2.0252 19.5865 2.60395 19.8504 3.24091C20.1142 3.87787 20.25 4.56056 20.25 5.25H28.875C29.1734 5.25 29.4595 5.36853 29.6705 5.5795C29.8815 5.79048 30 6.07663 30 6.375C30 6.67337 29.8815 6.95952 29.6705 7.1705C29.4595 7.38147 29.1734 7.5 28.875 7.5H26.895L25.14 25.6665C25.0054 27.0585 24.3571 28.3504 23.3215 29.2902C22.286 30.2301 20.9375 30.7505 19.539 30.75H10.461C9.0628 30.7502 7.71465 30.2296 6.67942 29.2897C5.6442 28.3499 4.9961 27.0582 4.8615 25.6665L3.105 7.5H1.125C0.826631 7.5 0.540483 7.38147 0.329505 7.1705C0.118526 6.95952 0 6.67337 0 6.375C0 6.07663 0.118526 5.79048 0.329505 5.5795C0.540483 5.36853 0.826631 5.25 1.125 5.25H9.75ZM12.75 12.375C12.75 12.0766 12.6315 11.7905 12.4205 11.5795C12.2095 11.3685 11.9234 11.25 11.625 11.25C11.3266 11.25 11.0405 11.3685 10.8295 11.5795C10.6185 11.7905 10.5 12.0766 10.5 12.375V23.625C10.5 23.9234 10.6185 24.2095 10.8295 24.4205C11.0405 24.6315 11.3266 24.75 11.625 24.75C11.9234 24.75 12.2095 24.6315 12.4205 24.4205C12.6315 24.2095 12.75 23.9234 12.75 23.625V12.375ZM18.375 11.25C18.0766 11.25 17.7905 11.3685 17.5795 11.5795C17.3685 11.7905 17.25 12.0766 17.25 12.375V23.625C17.25 23.9234 17.3685 24.2095 17.5795 24.4205C17.7905 24.6315 18.0766 24.75 18.375 24.75C18.6734 24.75 18.9595 24.6315 19.1705 24.4205C19.3815 24.2095 19.5 23.9234 19.5 23.625V12.375C19.5 12.0766 19.3815 11.7905 19.1705 11.5795C18.9595 11.3685 18.6734 11.25 18.375 11.25Z" fill="#646464"/>
												</svg>
											</button>
										</div>
									</div>
								))}
								<button className={styles.parametersTableAdd} onClick={paramsAddHandler}>
									<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M18 30V18M18 18V6M18 18H30M18 18H6" stroke="#646464" stroke-width="3" stroke-linecap="round"/>
									</svg>
								</button>
							</div>
						</div>
					)}
					{width > 500 && <button onClick={createItem} className={styles.createBtn} disabled={!title || isCreateFetching}>Create item</button>}
				</div>
				<div className={styles.rightContainer}>
					<p className={styles.label}>Preview</p>
					<div className={styles.previewContainer}>
						{imageNft && !imageNft.includes('video/mp4') ? (
							<RenderImage image={imageNft} nft={{} as Nft} author={account}/>
						)
						: (
							<video preload="metadata" autoPlay src={imageNft} poster="" loop  style={{width: '316px', height: '316px', borderRadius: '12px'}}></video>
						)
					}
					</div>
				</div>
				{width < 501 && <button disabled={!title || isCreateFetching} onClick={createItem} className={styles.createBtn}>Create item</button>}
			</div>
		</div>
		<Footer />
	</>
	);
};

export default CreateNFT;

