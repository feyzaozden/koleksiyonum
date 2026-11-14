import ItemsGrid from './ItemsGrid'
import MusicCollection from './MusicCollection'

export default function CollectionGrid({ musicOwner, allSongs, musicFilters, ...gridProps }) {
  return musicOwner ? <MusicCollection filters={musicFilters} ownerId={musicOwner} allSongs={allSongs} gridProps={{ ...gridProps, activeFilter: 'tumu' }} /> : <ItemsGrid {...gridProps} />
}
