import * as  _ from 'lodash';
import {ActionContextBasic} from '@/store';
import {File} from './file';
import {beginAddTime, convertTimeStrToSecond} from '@/utils/utils';
import {LoopMode} from '@/utils/enum/LoopMode';
import Vue from 'vue'
import config from '@/utils/config';
import {LocalStorageKeys} from '@/utils/enum/LocalStorageKeys';


const initState: IState = {
  serverPath: '',
  playing: false,
  currentTime: 0,
  duration: 0,
  durationStr:'',
  volume: 30,
  timer: 0,
  fps: 5,
  loopMode: LoopMode.close,
  isRandom: false,
  isMute: false,
  isLoading:false
};

const state: IState = _.cloneDeep(initState);

export interface IState {
  serverPath: string,
  playing: boolean,
  currentTime: number,
  duration: number,
  volume: number,
  timer: number,
  fps: 5,
  loopMode: LoopMode,
  isRandom: boolean,
  isMute: boolean,
  isLoading:boolean,
  durationStr:string
}


export function getTimeStr(time: number) {
  let sec = Math.floor(time % 60);
  let second = sec < 10 ? '0' + sec : sec;
  let minute = Math.floor(time / 60);
  return `${minute}:${second}`;
}

const getters = {
  currentTimeStr(state: IState) {
    return getTimeStr(state.currentTime > state.duration ? state.duration : state.currentTime);
  },
  durationTimeStr(state: IState) {
    return getTimeStr(state.duration);
  },
  timePercent(state: IState) {
    return state.currentTime / state.duration * 100;
  }
};

const actions = {
  init({dispatch}: ActionContextBasic) {
    const player = <HTMLAudioElement> document.getElementById('player');
    player.loop = false;
    player.addEventListener('ended', function () {
      // commit('setPlaying', false);
      // clearInterval(state.timer);
      dispatch('handleEnd');
    });
    player.volume = state.volume / 100;
  },

  handleEnd({commit, dispatch, rootState, state}: ActionContextBasic) {
    if (state.isRandom) {
      dispatch('randomPlay');
      return;
    }

    switch (state.loopMode) {
      case LoopMode.close:
        const playingFile = rootState.home.playingFile;
        const playingList = rootState.playList.playingList;
        const index = playingList.findIndex(o => o.id == playingFile.id);
        if (index === playingList.length - 1) {
          commit('setPlaying', false);
          clearInterval(state.timer);
        } else {
          dispatch('play', playingList[index + 1]);
        }
        break;
      case LoopMode.loopAll:
        dispatch('toNext');
        break;
      case LoopMode.loopSingle:
        dispatch('play', rootState.home.playingFile);
        break;
    }
  },

  play({state, commit, rootState, dispatch}: ActionContextBasic, file: File) {
    if(state.isLoading) return
    commit('setLoading',true)
    const musicPath = file.musicUrl.endsWith(config.musicExt)?file.musicUrl:file.musicUrl.split('.')[0]+`.${config.musicExt}`;
    commit('initPlay', musicPath);
    setTimeout(()=>{
      const player = <HTMLAudioElement> document.getElementById('player');
      player.load();
      clearInterval(state.timer);
      const msg = (new Vue()).$Message.loading({
        content:'正在加载...',
        duration:0
      })
      player.onloadeddata = function () {
        commit('setMusicInfo',file.time);
        let timer = setInterval(() => {
          commit('addCurrentTime');
        }, 1000 / state.fps);
        commit('setTimer', timer);
        player.play();
        msg()
        commit('setLoading',false)
      };
      // 设置当前播放文件
      dispatch('home/setPlayingFile', file, {root: true});
      if (!rootState.home.isInRecentPlay) {
        dispatch('playList/addRecentPlay', file, {root: true});
      }
    })
  },

  abort({commit, dispatch}: ActionContextBasic) {
    dispatch('home/setPlayingFile', new File(), {root: true});
    const player = <HTMLAudioElement> document.getElementById('player');
    player.pause();
    commit('clearPlaying');
  },

  togglePlay({commit, rootState, state, dispatch}: ActionContextBasic) {
    if(state.isLoading) return
    if (rootState.playList.playingList.length == 0 || rootState.home.playingFile.id == 0) {
      return;
    }
    const player = <HTMLAudioElement> document.getElementById('player');

    if (state.serverPath !== rootState.home.playingFile.musicUrl) {
      dispatch('play', rootState.home.playingFile);
      return;
    }

    if (player.paused) {
      player.play();
      const timer = setInterval(() => {
        commit('addCurrentTime');
      }, 1000 / state.fps);
      commit('setTimer', timer);
      commit('setPlaying', true);
    } else {
      player.pause();
      commit('setPlaying', false);
      clearInterval(state.timer);
    }
  },

  toPrev({dispatch, rootState}: ActionContextBasic) {
    const playingFile = rootState.home.playingFile;
    const playingList = rootState.playList.playingList;

    if (playingList.length === 0) return;

    if (state.isRandom) {
      dispatch('randomPlay');
      return;
    }
    let index = playingList.findIndex(o => o.id === playingFile.id) - 1;
    if (index < 0) index = playingList.length - 1;
    dispatch('play', playingList[index]);
  },
  toNext({dispatch, rootState}: ActionContextBasic) {


    const playingFile = rootState.home.playingFile;
    const playingList = rootState.playList.playingList;

    if (playingList.length === 0) return;

    if (state.isRandom) {
      dispatch('randomPlay');
      return;
    }

    let index = playingList.findIndex(o => o.id === playingFile.id) + 1;
    if (index >= playingList.length) index = 0;
    dispatch('play', playingList[index]);
  },
  randomPlay({dispatch, rootState}: ActionContextBasic) {
    const playingList = rootState.playList.playingList;
    const index = Math.floor(Math.random() * playingList.length);
    dispatch('play', playingList[index]);
  },
  stop({commit}: ActionContextBasic) {
    const player = <HTMLAudioElement> document.getElementById('player');
    player.pause();
    commit('setPlaying', false);
    clearInterval(state.timer);
  }
};

const mutations = {
  initPlay(state: IState, path: string) {
    state.serverPath = path;
  },
  initVolume(state:IState,vol:number){
    state.volume = vol
  },
  clearPlaying(state: IState) {
    clearInterval(state.timer);
    state.duration = 0;
    state.currentTime = 0;
    state.serverPath = '';
  },
  setMusicInfo(state:IState,time:string) {
    // const player = <HTMLAudioElement> document.getElementById('player');
    // state.duration = player.duration;
    state.duration = convertTimeStrToSecond(time)
    state.currentTime = 0;
    state.playing = true;
  },
  setTimer(state: IState, timer: number) {
    state.timer = timer;
  },
  /**
   * 当前时间自增
   * @param state
   */
  addCurrentTime(state: IState) {
    state.currentTime += 1 / state.fps;
  },

  setPlaying(state: IState, b: boolean) {
    state.playing = b;
  },
  handleSelectTime(state: IState, val: number) {
    state.currentTime = state.duration * val / 100;
    const player = <HTMLAudioElement> document.getElementById('player');
    player.currentTime = state.currentTime;

    if (state.playing) {
      beginAddTime()
    }
  },
  handleInputTime(state:IState){
    clearInterval(state.timer)
  },

  handleChangeVolume(state: IState, val: number) {
    state.isMute = false;
    state.volume = val;
    const player = <HTMLAudioElement> document.getElementById('player');
    player.volume = state.volume / 100;
    localStorage.setItem(LocalStorageKeys.volume,val.toString())
  },

  toggleRandom(state: IState) {
    state.isRandom = !state.isRandom;
  },

  switchLoopMode(state: IState) {
    switch (state.loopMode) {
      case LoopMode.close:
        state.loopMode = LoopMode.loopAll;
        break;
      case LoopMode.loopAll:
        state.loopMode = LoopMode.loopSingle;
        break;
      case LoopMode.loopSingle:
        state.loopMode = LoopMode.close;
        break;
    }
  },

  toggleMute(state: IState) {
    const player = <HTMLAudioElement> document.getElementById('player');
    state.isMute = !state.isMute;
    player.muted = state.isMute;
  },
  addVolume(state: IState, num: number) {
    const volume = state.volume;
    if (volume + num > 100) {
      state.volume = 100;
      return;
    }
    if (volume + num < 0) {
      state.volume = 0;
      return;
    }
    state.volume += num;
  },
  setLoading(state:IState,isLoading:boolean){
    state.isLoading = isLoading
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};
