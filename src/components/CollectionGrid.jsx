import ItemsGrid from './ItemsGrid'
import MusicCollection from './MusicCollection'

export default function CollectionGrid({ musicOwner, allSongs, ...gridProps }) {
  return musicOwner ? <MusicCollection ownerId={musicOwner} allSongs={allSongs} gridProps={{ ...gridProps, activeFilter: 'tumu' }} /> : <ItemsGrid {...gridProps} />
}
