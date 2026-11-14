import ItemsGrid from './ItemsGrid'
import MusicCollection from './MusicCollection'

export default function CollectionGrid({ musicOwner, allSongs, musicFilters, onAddMusic, ...gridProps }) {
  return musicOwner ? <MusicCollection onAddMusic={onAddMusic} filters={musicFilters} ownerId={musicOwner} allSongs={allSongs} gridProps={{ ...gridProps, activeFilter: 'tumu' }} /> : <ItemsGrid {...gridProps} />
}
