'use client'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Utensils, Users, Droplets, Navigation, Sun, Moon, Wifi, WifiOff, HelpCircle, Brain, Volume2, AlertTriangle, Loader2 } from 'lucide-react';

interface Option {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    lightColor: string;
    soundFile: string;
}
// Define types for Bluetooth objects
interface BluetoothDevice extends EventTarget {
    gatt?: BluetoothRemoteGATTServer;
}
declare global {
    interface Navigator {
        bluetooth: {
            requestDevice(options: {
                filters: Array<{ name?: string }>;
                optionalServices?: string[];
            }): Promise<BluetoothDevice>;
        };
    }
}
interface BluetoothRemoteGATTServer {
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    connected: boolean;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    startNotifications(): Promise<void>;
    stopNotifications(): Promise<void>;
    readValue(): Promise<DataView>;
    value?: DataView;
}
const CommunicationInterface: React.FC = () => {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [device, setDevice] = useState<BluetoothDevice | null>(null);
    const [activeSelection, setActiveSelection] = useState<string | null>(null);
    const [currentMenuIndex, setCurrentMenuIndex] = useState(0);
    const [menuActive, setMenuActive] = useState(false);

    // Memoize options to prevent unnecessary re-renders
    const options: Option[] = useMemo(() => [
        {
            id: 'food',
            label: 'Food',
            icon: <Utensils size={52} strokeWidth={1.5} />,
            color: 'bg-orange-500',
            lightColor: 'bg-orange-400',
            soundFile: 'food.mp3'
        },
        {
            id: 'help',
            label: 'Help',
            icon: <HelpCircle size={52} strokeWidth={1.5} />,
            color: 'bg-red-500',
            lightColor: 'bg-red-400',
            soundFile: 'help.mp3'
        },
        {
            id: 'outing',
            label: 'Outing',
            icon: <Users size={52} strokeWidth={1.5} />,
            color: 'bg-blue-500',
            lightColor: 'bg-blue-400',
            soundFile: 'outing.mp3'
        },
        {
            id: 'television',
            label: 'Television',
            icon: <div className="text-2xl sm:text-3xl lg:text-4xl">📺</div>,
            color: 'bg-indigo-500',
            lightColor: 'bg-indigo-400',
            soundFile: 'television.mp3'
        },
        {
            id: 'washroom',
            label: 'Washroom',
            icon: <Navigation size={52} strokeWidth={1.5} />,
            color: 'bg-purple-500',
            lightColor: 'bg-purple-400',
            soundFile: 'washroom.mp3'
        },
        {
            id: 'water',
            label: 'Water',
            icon: <Droplets size={52} strokeWidth={1.5} />,
            color: 'bg-cyan-500',
            lightColor: 'bg-cyan-400',
            soundFile: 'water.mp3'
        }
    ], []);

    const playSound = useCallback((soundFile: string) => {
        try {
            const audio = new Audio(`./sounds/${soundFile}`);
            audio.volume = 0.7;
            audio.play().catch(error => {
                console.log('Audio play failed:', error);
            });
        } catch (error) {
            console.log('Audio creation failed:', error);
        }
    }, []);
    const handleNotifications = useCallback((event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (!value) return;

        // Convert DataView to Uint8Array
        const data = new Uint8Array(value.buffer);

        // Handle different notification types based on your ESP32 code
        if (data.length === 1) {
            // Menu state change (0 = off, 127 = timeout)
            if (data[0] === 0) {
                // Menu activated
                setMenuActive(true);
                setCurrentMenuIndex(1); // Start with first option
                setActiveSelection(null);
            } else if (data[0] === 127) {
                // Menu timed out
                setMenuActive(false);
                setCurrentMenuIndex(0);
                setActiveSelection(null);
            }
        } else if (data.length === 2) {
            // Menu selection change
            if (data[0] === 'S'.charCodeAt(0)) {
                // 'S' for selection change
                const newIndex = data[1];
                setMenuActive(true);
                setCurrentMenuIndex(newIndex);
                setActiveSelection(null); // Clear active selection when navigating
                // Play navigation tone with pitch based on position
            } else if (data[0] === 'A'.charCodeAt(0)) {
                // 'A' for activation/selection
                const selectedIndex = data[1];
                if (selectedIndex > 0 && selectedIndex <= options.length) {
                    const optionId = options[selectedIndex - 1].id;
                    setSelectedOption(optionId);
                    setActiveSelection(optionId); // Set as active selection
                    playSound(options[selectedIndex - 1].soundFile); // Play the full sound file
                    // Reset after sound plays (optional)
                    setTimeout(() => {
                        setActiveSelection(null);
                    }, 3000);
                }
            }
        }
    }, [options, playSound]);


    // Handle menu index changes
    useEffect(() => {
        if (menuActive && currentMenuIndex > 0 && currentMenuIndex <= options.length) {
            // Highlight the current menu option
            const optionId = options[currentMenuIndex - 1].id;
            setSelectedOption(optionId);
            playSound("select.mp3");
        } else if (!menuActive) {
            setSelectedOption(null);
        }
    }, [currentMenuIndex, menuActive, options, playSound]);

    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const connectedDeviceRef = useRef<BluetoothDevice | null>(null);

    // Then modify your connection handling code
    const connectToDevice = useCallback(async () => {
        try {
            setIsConnecting(true);
            setConnectionError(null);

            if (!navigator.bluetooth || !navigator.bluetooth.requestDevice) {
                throw new Error('Web Bluetooth not supported');
            }

            console.log('Requesting Bluetooth Device...');
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'ESP32C6_EEG' }],
                optionalServices: ['6910123a-eb0d-4c35-9a60-bebe1dcb549d']
            }) as BluetoothDevice;

            connectedDeviceRef.current = device;

            if (!device.gatt) {
                throw new Error('Bluetooth device does not support GATT');
            }

            device.addEventListener('gattserverdisconnected', handleDisconnection);

            console.log('Connecting to GATT Server...');
            const server = await device.gatt.connect();

            console.log('Getting Service...');
            const service = await server.getPrimaryService('6910123a-eb0d-4c35-9a60-bebe1dcb549d');

            console.log('Getting Characteristic...');
            const characteristic = await service.getCharacteristic('5f4f1107-7fc1-43b2-a540-0aa1a9f1ce78');

            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', handleNotifications);

            setDevice(device);
            setIsConnected(true);
            setIsConnecting(false);

            console.log('Successfully connected');
            return true;
        } catch (error) {
            console.error('Connection failed:', error);
            setIsConnecting(false);
            setIsConnected(false);
            setConnectionError(error instanceof Error ? error.message : 'Connection failed');
            return false;
        }
    }, [handleNotifications]);
    // Simplified disconnection handler - no reconnection attempts
    const handleDisconnection = useCallback(() => {
        console.log('Device disconnected');
        setIsConnected(false);
        setMenuActive(false);
        setCurrentMenuIndex(0);
        // No reconnection logic here
    }, [setIsConnected, setMenuActive, setCurrentMenuIndex]);

    // Disconnect function remains similar but without reconnection concerns
    const disconnectDevice = useCallback(async () => {
        try {
            if (!connectedDeviceRef.current) {
                console.log("No connected device to disconnect.");
                return;
            }

            const server = connectedDeviceRef.current.gatt;
            if (!server) {
                return;
            }

            if (!server.connected) {
                connectedDeviceRef.current = null;
                setIsConnected(false);
                return;
            }

            // Add await to these asynchronous operations
            const service = await server.getPrimaryService("6910123a-eb0d-4c35-9a60-bebe1dcb549d");
            const dataChar = await service.getCharacteristic("5f4f1107-7fc1-43b2-a540-0aa1a9f1ce78");

            await dataChar.stopNotifications();
            dataChar.removeEventListener("characteristicvaluechanged", handleNotifications);

            server.disconnect();
        } catch (error) {
            console.error("Error during disconnection:", error);
        } finally {
            setDevice(null);
            setIsConnected(false);
            setIsConnecting(false);
            setMenuActive(false);
            setCurrentMenuIndex(0);
        }
    }, [handleNotifications]);
    const toggleConnection = async () => {
        if (isConnected) {
            disconnectDevice();
        } else {
            await connectToDevice();
        }
    };

    // Update the connection status UI to show connecting state
    const connectionStatusText = () => {
        if (isConnected) return 'Connected';
        if (device && !isConnected) return 'Connecting...';
        return 'Disconnected';
    };

    const connectionStatusIcon = () => {
        if (isConnected) return <Wifi size={20} className="text-emerald-500" />;
        if (device && !isConnected) return <Loader2 size={20} className="text-sky-500 motion-safe:animate-spin" />;
        return <WifiOff size={20} className="text-rose-500" />;
    };

    const handleOptionClick = (option: Option) => {
        if (!isConnected) {
            alert('Please connect first!');
            return;
        }

        setSelectedOption(selectedOption === option.id ? null : option.id);
        playSound(option.soundFile);
    };

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // UI ONLY BELOW THIS LINE (theme + markup).
    // Everything above (Bluetooth, notifications, menu state, audio) is unchanged.
    // ─────────────────────────────────────────────────────────────────────────

    const dark = isDarkMode;
    const t = {
        page: dark ? 'bg-slate-950 text-slate-50' : 'bg-stone-100 text-slate-900',
        glow: dark
            ? 'radial-gradient(60rem 40rem at 85% -10%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(50rem 36rem at -10% 110%, rgba(20,184,166,0.14), transparent 60%)'
            : 'radial-gradient(60rem 40rem at 85% -10%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(50rem 36rem at -10% 110%, rgba(20,184,166,0.10), transparent 60%)',
        surface: dark ? 'bg-slate-900 border-slate-700/80' : 'bg-white border-slate-200',
        surfaceHover: dark ? 'hover:bg-slate-800 hover:border-slate-500' : 'hover:bg-slate-50 hover:border-slate-400',
        raised: dark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200',
        muted: dark ? 'text-slate-400' : 'text-slate-600',
        strong: dark ? 'text-white' : 'text-slate-900',
        control: dark
            ? 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-100'
            : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-800',
    };

    // Derived display values (read-only; no state is changed here)
    const highlightedOption =
        menuActive && currentMenuIndex > 0 && currentMenuIndex <= options.length
            ? options[currentMenuIndex - 1]
            : null;
    const speakingOption = options.find((o) => o.id === activeSelection) ?? null;

    let bannerTone = 'idle';
    let bannerText = 'Connect your NeuralHelp device to begin.';
    if (isConnected) {
        if (speakingOption) {
            bannerTone = 'speaking';
            bannerText = `Speaking: ${speakingOption.label}`;
        } else if (highlightedOption) {
            bannerTone = 'scanning';
            bannerText = `Highlighting: ${highlightedOption.label}. Triple blink to choose it.`;
        } else if (menuActive) {
            bannerTone = 'scanning';
            bannerText = 'Menu is active. Double blink to move through the options.';
        } else {
            bannerTone = 'ready';
            bannerText = 'Connected. Double blink to activate the menu.';
        }
    }

    const bannerStyles: Record<string, string> = {
        idle: dark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white',
        ready: dark ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-500/60 bg-emerald-50',
        scanning: dark ? 'border-amber-400/60 bg-amber-400/10' : 'border-amber-500/70 bg-amber-50',
        speaking: dark ? 'border-emerald-400 bg-emerald-500/20' : 'border-emerald-500 bg-emerald-100',
    };
    const bannerDot: Record<string, string> = {
        idle: 'bg-slate-400',
        ready: 'bg-emerald-500',
        scanning: 'bg-amber-400',
        speaking: 'bg-emerald-500',
    };

    // Which "How it works" step is current
    const currentStep = !isConnected ? 0 : speakingOption ? 3 : menuActive ? 2 : 1;

    const steps = [
        { step: '01', title: 'Connect', desc: 'Connect to the NeuralHelp.' },
        { step: '02', title: 'Activate Menu', desc: 'Double blink to activate the menu.' },
        { step: '03', title: 'Switch Option', desc: 'Double blink to switch between the options.' },
        { step: '04', title: 'Select', desc: 'Triple blink to choose the selected option.' },
    ];

    return (
        <div
            className={`relative min-h-screen w-full ${t.page} transition-colors duration-500`}
            style={{ backgroundImage: t.glow }}
        >
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:px-10">

                {/* ───────────── Header ───────────── */}
                <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-400 text-white shadow-lg sm:h-14 sm:w-14">
                            <Brain size={28} strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h1 className={`text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl ${t.strong}`}>
                                NeuroSync <span className="text-indigo-400">M2W</span>
                            </h1>
                            <p className={`text-sm sm:text-base ${t.muted}`}>
                                Mind to Word(s) · Assistive Communication
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div
                            className={`flex min-h-[48px] items-center gap-2.5 rounded-2xl border px-4 text-sm font-semibold sm:text-base ${t.control}`}
                            role="status"
                            aria-label={`Device status: ${connectionStatusText()}`}
                        >
                            {connectionStatusIcon()}
                            <span>{connectionStatusText()}</span>
                            {menuActive && (
                                <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-900">
                                    Menu on
                                </span>
                            )}
                        </div>

                        <button
                            onClick={toggleTheme}
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/60 ${t.control}`}
                            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {isDarkMode ? <Sun size={22} className="text-amber-300" /> : <Moon size={22} className="text-slate-700" />}
                        </button>

                        <button
                            onClick={toggleConnection}
                            disabled={isConnecting}
                            className={`min-h-[48px] min-w-[9rem] rounded-2xl px-7 text-base font-bold text-white shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/60 sm:min-h-[56px] sm:text-lg
                                ${isConnected ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'}
                                ${isConnecting ? 'cursor-not-allowed opacity-70' : 'active:scale-95'}`}
                            aria-label={isConnected ? 'Disconnect device' : 'Connect device'}
                        >
                            {isConnecting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={20} className="motion-safe:animate-spin" aria-hidden="true" />
                                    Connecting…
                                </span>
                            ) : isConnected ? (
                                'Disconnect'
                            ) : (
                                'Connect'
                            )}
                        </button>
                    </div>
                </header>

                {connectionError && (
                    <div
                        role="alert"
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm sm:text-base ${dark ? 'border-rose-500/50 bg-rose-500/10 text-rose-200' : 'border-rose-300 bg-rose-50 text-rose-800'}`}
                    >
                        <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <p className="break-words">
                            <span className="font-semibold">Couldn&apos;t connect: </span>
                            {connectionError}
                        </p>
                    </div>
                )}

                {/* ───────────── Live status banner ───────────── */}
                <div
                    className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 transition-colors duration-300 sm:px-6 sm:py-5 ${bannerStyles[bannerTone]}`}
                    role="status"
                    aria-live="polite"
                >
                    <span className="relative flex h-3.5 w-3.5 shrink-0">
                        {bannerTone !== 'idle' && (
                            <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${bannerDot[bannerTone]}`} />
                        )}
                        <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ${bannerDot[bannerTone]}`} />
                    </span>
                    <p className={`text-lg font-semibold sm:text-xl lg:text-2xl ${t.strong}`}>{bannerText}</p>
                </div>

                {/* ───────────── Options ───────────── */}
                <main className="flex-1">
                    <div className="grid h-full auto-rows-fr grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-6">
                        {options.map((option, index) => {
                            const isSelected = selectedOption === option.id;
                            const isScanning = menuActive && currentMenuIndex === index + 1;
                            const isSpeaking = activeSelection === option.id;

                            let tileState = `${t.surface} ${t.surfaceHover}`;
                            if (isSpeaking) {
                                tileState = `${option.color} border-transparent text-white shadow-2xl scale-[1.03]`;
                            } else if (isScanning) {
                                tileState = `${dark ? 'bg-amber-400/15' : 'bg-amber-50'} border-amber-400 ring-4 ring-amber-400/80 scale-[1.03] shadow-xl`;
                            } else if (isSelected) {
                                tileState = `${t.surface} border-emerald-400`;
                            }

                            const chip = isSpeaking ? 'Speaking' : isScanning ? 'Scanning' : isSelected ? 'Selected' : null;
                            const chipStyle = isSpeaking
                                ? 'bg-white/25 text-white'
                                : isScanning
                                    ? 'bg-amber-400 text-slate-900'
                                    : 'bg-emerald-500 text-white';

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleOptionClick(option)}
                                    aria-pressed={isSelected}
                                    aria-disabled={!isConnected}
                                    aria-label={`${option.label}${isScanning ? ', currently highlighted' : ''}${isSpeaking ? ', speaking' : ''}`}
                                    className={`relative flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-3xl border-2 p-4 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/70 sm:min-h-[12rem] sm:gap-4 lg:min-h-[15rem]
                                        ${tileState}
                                        ${!isConnected ? 'cursor-not-allowed opacity-60' : 'cursor-pointer active:scale-[0.97]'}`}
                                >
                                    <span
                                        className={`absolute left-4 top-3 text-sm font-bold tabular-nums sm:text-base ${isSpeaking ? 'text-white/80' : t.muted}`}
                                        aria-hidden="true"
                                    >
                                        {index + 1}
                                    </span>

                                    {chip && (
                                        <span className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide sm:text-xs ${chipStyle}`}>
                                            {isSpeaking && <Volume2 size={14} aria-hidden="true" />}
                                            {chip}
                                        </span>
                                    )}

                                    <span
                                        className={`flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-md sm:h-20 sm:w-20 lg:h-24 lg:w-24
                                            ${isSpeaking ? 'bg-white/25' : option.color}`}
                                    >
                                        {React.isValidElement(option.icon) && typeof option.icon.type === 'function'
                                            ? React.cloneElement(option.icon as React.ReactElement<{ className?: string }>, {
                                                className: 'h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12',
                                            })
                                            : option.icon}
                                    </span>

                                    <span className={`text-xl font-extrabold leading-tight sm:text-2xl lg:text-3xl ${isSpeaking ? 'text-white' : t.strong}`}>
                                        {option.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </main>

                {/* ───────────── How it works ───────────── */}
                <footer className="pb-2">
                    <h2 className={`mb-3 text-sm font-bold uppercase tracking-widest ${t.muted}`}>How it works</h2>
                    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {steps.map((item, i) => {
                            const isCurrent = i === currentStep;
                            return (
                                <li
                                    key={item.step}
                                    aria-current={isCurrent ? 'step' : undefined}
                                    className={`flex items-start gap-4 rounded-2xl border p-4 transition-colors duration-300
                                        ${isCurrent
                                            ? (dark ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50')
                                            : t.raised}`}
                                >
                                    <span
                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold
                                            ${isCurrent ? 'bg-indigo-500 text-white' : (dark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700')}`}
                                    >
                                        {item.step}
                                    </span>
                                    <div>
                                        <p className={`text-base font-bold ${t.strong}`}>{item.title}</p>
                                        <p className={`text-sm leading-relaxed ${t.muted}`}>{item.desc}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </footer>
            </div>
        </div>
    );
};

export default CommunicationInterface;
