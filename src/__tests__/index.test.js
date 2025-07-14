/**
 * Basic test for the main page
 */

import { render, screen } from '@testing-library/react'
import Home from '../pages/index'

describe('Home Page', () => {
  it('renders the main heading', () => {
    render(<Home />)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent('財務分析アプリケーション')
  })

  it('renders the search form', () => {
    render(<Home />)
    
    const searchInput = screen.getByLabelText('企業名')
    expect(searchInput).toBeInTheDocument()
    
    const searchButton = screen.getByRole('button', { name: '検索' })
    expect(searchButton).toBeInTheDocument()
  })

  it('shows description text', () => {
    render(<Home />)
    
    const description = screen.getByText(/企業名を入力して、直近5年分の貸借対照表/)
    expect(description).toBeInTheDocument()
  })
})